import mongoose from 'mongoose';
import Product from '../../models/Product.js';
import { ensureStock, syncProductStock, recordMovement, maybeRaiseAlerts } from './stockService.js';
import { logInventoryAction } from './inventoryAuditService.js';

// Purchase → goods received → inspected → accepted stock in.
// Damaged units go to the damaged bucket, never to sellable stock.
export const receivePurchase = async ({ purchase, accepted = [], damaged = [], warehouseId = null, actor = null, performedByType = 'HUMAN' }) => {
  // Idempotency FIRST (before any $inc): a re-receive must never double stock.
  const StockMovement = (await import('../../models/StockMovement.js')).default;
  const already = await StockMovement.findOne({ referenceType: 'PURCHASE', referenceId: String(purchase._id) });
  if (already) return { purchase, duplicate: true };
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const apply = async (items, bucket, type) => {
        for (const it of items) {
          if (!it.product || !it.quantity) continue;
          const seed = await ensureStock({ productId: it.product, warehouseId });
          const { default: InventoryStock } = await import('../../models/InventoryStock.js');
          const before = bucket === 'damaged' ? seed.damaged : seed.onHand;
          const inc = bucket === 'damaged' ? { damaged: it.quantity } : { onHand: it.quantity, available: it.quantity };
          const updated = await InventoryStock.findOneAndUpdate({ _id: seed._id }, { $inc: inc }, { new: true, session });
          const recompute = (d) => {
            d.available = Math.max(0, (d.onHand || 0) - (d.reserved || 0) - (d.damaged || 0) - (d.lost || 0) - (d.expired || 0));
            d.status = d.available <= 0 ? 'OUT_OF_STOCK' : d.available <= (d.reorderLevel || 0) ? 'LOW_STOCK' : 'IN_STOCK';
          };
          recompute(updated);
          // Weighted-average cost update on accepted goods
          if (bucket !== 'damaged' && it.costPrice > 0) {
            const totalQty = (updated.onHand || 0);
            const prevQty = totalQty - it.quantity;
            updated.averageCost = totalQty > 0 ? ((updated.averageCost || 0) * prevQty + it.costPrice * it.quantity) / totalQty : it.costPrice;
            updated.lastPurchaseCost = it.costPrice;
          }
          await updated.save({ session });
          await recordMovement({
            product: it.product, variantKey: seed.variantKey, sku: seed.sku, warehouse: seed.warehouse,
            type, quantity: it.quantity, beforeQuantity: before,
            afterQuantity: bucket === 'damaged' ? updated.damaged : updated.onHand,
            referenceType: 'PURCHASE', referenceId: String(purchase._id),
            idempotencyKey: `PURCHASE:${purchase._id}:${it.product}:${type}`,
            performedBy: actor?._id || null, performedByType,
          });
          if (bucket !== 'damaged' && it.costPrice > 0) {
            await Product.findByIdAndUpdate(it.product, { $set: { costPrice: it.costPrice } }, { session });
          }
          await syncProductStock(it.product);
          await maybeRaiseAlerts(updated, actor);
        }
      };
      await apply(accepted, 'good', 'PURCHASE');
      await apply(damaged, 'damaged', 'DAMAGED');
      purchase.status = 'RECEIVED';
      purchase.receiveDate = new Date();
      await purchase.save({ session });
    });
  } finally {
    await session.endSession();
  }
  await logInventoryAction({ action: 'PURCHASE_RECEIVED', actor, performedByType, entityType: 'Purchase', entityId: purchase._id, newValue: { accepted: accepted.length, damaged: damaged.length } });
  return purchase;
};

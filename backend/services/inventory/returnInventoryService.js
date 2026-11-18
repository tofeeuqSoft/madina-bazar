import StockMovement from '../../models/StockMovement.js';
import { ensureStock, syncProductStock, recordMovement, maybeRaiseAlerts } from './stockService.js';
import { logInventoryAction } from './inventoryAuditService.js';

// Return NEVER auto-restocks. Inspection classifies each unit:
// GOOD → sellable, DAMAGED/DEFECTIVE/OPENED → damaged bucket, EXPIRED → expired.
export const inspectReturn = async ({ returnDoc, inspections = [], warehouseId = null, actor = null, performedByType = 'HUMAN' }) => {
  const results = [];
  for (const ins of inspections) {
    if (!ins.product || !ins.quantity) continue;
    const key = `RETURN:${returnDoc._id}:${ins.product}:${ins.condition}`;
    if (await StockMovement.findOne({ idempotencyKey: key })) {
      results.push({ product: ins.product, duplicate: true });
      continue;
    }
    const seed = await ensureStock({ productId: ins.product, warehouseId });
    const { default: InventoryStock } = await import('../../models/InventoryStock.js');
    let inc, type, before;
    if (ins.condition === 'GOOD') {
      before = seed.onHand;
      inc = { onHand: ins.quantity, available: ins.quantity };
      type = 'RESTOCK';
    } else if (ins.condition === 'EXPIRED') {
      before = seed.expired;
      inc = { expired: ins.quantity };
      type = 'EXPIRED';
    } else {
      before = seed.damaged;
      inc = { damaged: ins.quantity };
      type = 'DAMAGED';
    }
    const updated = await InventoryStock.findOneAndUpdate({ _id: seed._id }, { $inc: inc }, { new: true });
    const recompute = (d) => {
      d.available = Math.max(0, (d.onHand || 0) - (d.reserved || 0) - (d.damaged || 0) - (d.lost || 0) - (d.expired || 0));
      d.status = d.available <= 0 ? 'OUT_OF_STOCK' : d.available <= (d.reorderLevel || 0) ? 'LOW_STOCK' : 'IN_STOCK';
    };
    recompute(updated);
    await updated.save();
    await recordMovement({
      product: ins.product, variantKey: seed.variantKey, sku: seed.sku, warehouse: seed.warehouse,
      type, quantity: ins.quantity, beforeQuantity: before,
      afterQuantity: type === 'RESTOCK' ? updated.onHand : type === 'EXPIRED' ? updated.expired : updated.damaged,
      referenceType: 'RETURN', referenceId: String(returnDoc._id), idempotencyKey: key,
      reason: ins.note || `Return inspection: ${ins.condition}`, performedBy: actor?._id || null, performedByType,
    });
    await syncProductStock(ins.product);
    await maybeRaiseAlerts(updated, actor);
    results.push({ product: ins.product, condition: ins.condition, quantity: ins.quantity });
  }
  await logInventoryAction({ action: 'RETURN_RESTOCKED', actor, performedByType, entityType: 'Return', entityId: returnDoc._id, newValue: { results } });
  return results;
};

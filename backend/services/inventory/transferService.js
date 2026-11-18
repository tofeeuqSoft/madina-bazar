import mongoose from 'mongoose';
import WarehouseTransfer from '../../models/WarehouseTransfer.js';
import { ensureStock, syncProductStock, recordMovement, maybeRaiseAlerts } from './stockService.js';
import { logInventoryAction } from './inventoryAuditService.js';

const recompute = (d) => {
  d.available = Math.max(0, (d.onHand || 0) - (d.reserved || 0) - (d.damaged || 0) - (d.lost || 0) - (d.expired || 0));
  d.status = d.available <= 0 ? 'OUT_OF_STOCK' : d.available <= (d.reorderLevel || 0) ? 'LOW_STOCK' : 'IN_STOCK';
};

export const createTransfer = async ({ items, fromWarehouse, toWarehouse, reason = '', actor }) => {
  if (String(fromWarehouse) === String(toWarehouse)) {
    const e = new Error('Source and destination warehouses must differ');
    e.statusCode = 400;
    throw e;
  }
  const t = await WarehouseTransfer.create({ items, fromWarehouse, toWarehouse, reason, requestedBy: actor._id });
  await logInventoryAction({ action: 'STOCK_TRANSFER_CREATED', actor, entityType: 'WarehouseTransfer', entityId: t._id, newValue: { transferNo: t.transferNo, items }, reason });
  return t;
};

// Approve → IN_TRANSIT + TRANSFER_OUT at source (atomic per item; session for all).
export const approveTransfer = async ({ transfer, actor }) => {
  if (!['REQUESTED'].includes(transfer.status)) {
    const e = new Error(`Cannot approve transfer in ${transfer.status}`);
    e.statusCode = 400;
    throw e;
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const it of transfer.items) {
        const seed = await ensureStock({ productId: it.product, variantKey: it.variantKey || '', warehouseId: transfer.fromWarehouse });
        const { default: InventoryStock } = await import('../../models/InventoryStock.js');
        const before = seed.onHand;
        const updated = await InventoryStock.findOneAndUpdate(
          { _id: seed._id, available: { $gte: it.quantity } },
          { $inc: { onHand: -it.quantity, available: -it.quantity } },
          { new: true, session }
        );
        if (!updated) throw Object.assign(new Error(`Insufficient stock for transfer (${seed.sku})`), { statusCode: 400, code: 'INSUFFICIENT_STOCK' });
        recompute(updated);
        await updated.save({ session });
        await recordMovement({
          product: it.product, variantKey: seed.variantKey, sku: seed.sku, warehouse: transfer.fromWarehouse,
          type: 'TRANSFER_OUT', quantity: -it.quantity, beforeQuantity: before, afterQuantity: updated.onHand,
          referenceType: 'TRANSFER', referenceId: transfer.transferNo, reason: transfer.reason,
          performedBy: actor._id,
        });
        await syncProductStock(it.product);
        await maybeRaiseAlerts(updated, actor);
      }
      transfer.status = 'IN_TRANSIT';
      transfer.approvedBy = actor._id;
      await transfer.save({ session });
    });
  } finally {
    await session.endSession();
  }
  await logInventoryAction({ action: 'STOCK_TRANSFER_APPROVED', actor, entityType: 'WarehouseTransfer', entityId: transfer._id, newValue: { transferNo: transfer.transferNo } });
  return transfer;
};

// Receive → TRANSFER_IN at destination.
export const receiveTransfer = async ({ transfer, actor }) => {
  if (!['APPROVED', 'IN_TRANSIT'].includes(transfer.status)) {
    const e = new Error(`Cannot receive transfer in ${transfer.status}`);
    e.statusCode = 400;
    throw e;
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const it of transfer.items) {
        const seed = await ensureStock({ productId: it.product, variantKey: it.variantKey || '', warehouseId: transfer.toWarehouse });
        const { default: InventoryStock } = await import('../../models/InventoryStock.js');
        const before = seed.onHand;
        const updated = await InventoryStock.findOneAndUpdate(
          { _id: seed._id },
          { $inc: { onHand: it.quantity, available: it.quantity } },
          { new: true, session }
        );
        recompute(updated);
        await updated.save({ session });
        await recordMovement({
          product: it.product, variantKey: seed.variantKey, sku: seed.sku, warehouse: transfer.toWarehouse,
          type: 'TRANSFER_IN', quantity: it.quantity, beforeQuantity: before, afterQuantity: updated.onHand,
          referenceType: 'TRANSFER', referenceId: transfer.transferNo, reason: transfer.reason,
          performedBy: actor._id,
        });
        await syncProductStock(it.product);
      }
      transfer.status = 'RECEIVED';
      transfer.receivedBy = actor._id;
      await transfer.save({ session });
    });
  } finally {
    await session.endSession();
  }
  await logInventoryAction({ action: 'STOCK_TRANSFER_RECEIVED', actor, entityType: 'WarehouseTransfer', entityId: transfer._id, newValue: { transferNo: transfer.transferNo } });
  return transfer;
};

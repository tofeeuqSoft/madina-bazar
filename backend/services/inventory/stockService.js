import mongoose from 'mongoose';
import Product from '../../models/Product.js';
import Warehouse from '../../models/Warehouse.js';
import InventoryStock from '../../models/InventoryStock.js';
import StockMovement from '../../models/StockMovement.js';
import { logInventoryAction } from './inventoryAuditService.js';

export const variantKeyOf = (size = '', color = '') => [size || '', color || ''].filter(Boolean).join('|');

const INSUFFICIENT = (sku, need, have) => {
  const e = new Error(`Insufficient stock for ${sku || 'product'} (need ${need}, have ${have})`);
  e.statusCode = 400;
  e.code = 'INSUFFICIENT_STOCK';
  return e;
};

// Default warehouse — auto-created once, reused everywhere (migration-safe).
export const defaultWarehouse = async () => {
  let w = await Warehouse.findOne({ isDefault: true });
  if (!w) {
    w = await Warehouse.findOne({ code: 'MAIN' });
    if (!w) {
      w = await Warehouse.create({ name: 'Main Warehouse', code: 'MAIN', isDefault: true, status: 'ACTIVE' });
    } else {
      w.isDefault = true;
      await w.save();
    }
  }
  return w;
};

// Lazy-migrate: first touch creates InventoryStock from Product.stock.
export const ensureStock = async ({ productId, size = '', color = '', warehouseId = null }) => {
  const warehouse = warehouseId || (await defaultWarehouse())._id;
  const variantKey = variantKeyOf(size, color);
  let doc = await InventoryStock.findOne({ product: productId, variantKey, warehouse });
  if (doc) return doc;
  try {
    const product = await Product.findById(productId).select('stock sku minStock costPrice');
    const onHand = Math.max(0, product?.stock || 0);
    doc = await InventoryStock.create({
      product: productId,
      variantKey,
      size,
      color,
      sku: product?.sku || '',
      warehouse,
      onHand,
      available: onHand,
      reorderLevel: product?.minStock ?? 10,
      lastPurchaseCost: product?.costPrice || 0,
      averageCost: product?.costPrice || 0,
      status: onHand <= 0 ? 'OUT_OF_STOCK' : onHand <= (product?.minStock ?? 10) ? 'LOW_STOCK' : 'IN_STOCK',
    });
  } catch (e) {
    if (e.code === 11000) doc = await InventoryStock.findOne({ product: productId, variantKey, warehouse });
    else throw e;
  }
  return doc;
};

const recompute = (d) => {
  d.available = Math.max(0, (d.onHand || 0) - (d.reserved || 0) - (d.damaged || 0) - (d.lost || 0) - (d.expired || 0));
  d.status = d.available <= 0 ? 'OUT_OF_STOCK' : d.available <= (d.reorderLevel || 0) ? 'LOW_STOCK' : 'IN_STOCK';
};

// Keep Product.stock (= total available) in sync so storefront/cart/order
// code keeps working with Inventory Service as the single source of truth.
export const syncProductStock = async (productId) => {
  try {
    const agg = await InventoryStock.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(productId) } },
      { $group: { _id: null, available: { $sum: '$available' } } },
    ]);
    await Product.findByIdAndUpdate(productId, { $set: { stock: Math.max(0, agg[0]?.available || 0) } });
  } catch (e) {
    console.error('syncProductStock', e.message);
  }
};

export const recordMovement = async ({
  product, variantKey = '', sku = '', warehouse, type, quantity,
  beforeQuantity, afterQuantity, referenceType = '', referenceId = '',
  idempotencyKey = '', reason = '', performedBy = null, performedByType = 'HUMAN', metadata = {},
}) => {
  if (idempotencyKey) {
    const existing = await StockMovement.findOne({ idempotencyKey });
    if (existing) return { movement: existing, duplicate: true };
  }
  const movement = await StockMovement.create({
    product, variantKey, sku, warehouse, type, quantity,
    beforeQuantity, afterQuantity, referenceType, referenceId,
    idempotencyKey: idempotencyKey || undefined,
    reason, performedBy, performedByType, metadata,
  });
  return { movement, duplicate: false };
};

// ---------- Centralized stock operations (all atomic, all audited) ----------

export const checkAvailable = async ({ productId, size = '', color = '', warehouseId = null, quantity }) => {
  const doc = await ensureStock({ productId, size, color, warehouseId });
  return { available: doc.available, sufficient: doc.available >= quantity, doc };
};

// reserveStock: ORDER_PLACED → hold units so concurrent orders can't oversell.
// Atomic: single findOneAndUpdate guarded by available >= qty.
export const reserveStock = async ({ productId, size = '', color = '', warehouseId = null, quantity, referenceId, actor = null, performedByType = 'HUMAN', ttlMin = 30 }) => {
  const seed = await ensureStock({ productId, size, color, warehouseId });
  const doc = await InventoryStock.findOneAndUpdate(
    { _id: seed._id, available: { $gte: quantity } },
    { $inc: { reserved: quantity, available: -quantity } },
    { new: true }
  );
  if (!doc) {
    const fresh = await InventoryStock.findById(seed._id);
    throw INSUFFICIENT(seed.sku, quantity, fresh?.available || 0);
  }
  recompute(doc);
  await doc.save();
  const { StockReservation } = await import('../../models/StockReservation.js').then((m) => ({ StockReservation: m.default }));
  await StockReservation.create({
    product: productId, variantKey: seed.variantKey, size: size || '', color: color || '',
    sku: seed.sku, warehouse: seed.warehouse,
    quantity, referenceType: 'ORDER', referenceId, createdBy: actor?._id || null,
    expiresAt: new Date(Date.now() + Math.max(1, Number(ttlMin) || 30) * 60000),
  });
  await logInventoryAction({ action: 'STOCK_RESERVED', actor, performedByType, entityType: 'InventoryStock', entityId: doc._id, newValue: { sku: seed.sku, quantity, available: doc.available }, metadata: { referenceId } });
  await syncProductStock(productId);
  return doc;
};

// Sweep: auto-release expired ACTIVE holds (stuck carts, crashed checkouts).
// Guarded + idempotent per row — a confirmed/converted order's rows are
// CONFIRMED, never ACTIVE, so the sweep can only free truly stuck stock.
export const sweepExpiredReservations = async ({ limit = 100 } = {}) => {
  const { default: StockReservation } = await import('../../models/StockReservation.js');
  const expired = await StockReservation.find({ status: 'ACTIVE', expiresAt: { $lt: new Date() } })
    .sort({ expiresAt: 1 }).limit(limit);
  const report = { checked: expired.length, released: 0, errors: [] };
  for (const r of expired) {
    try {
      await releaseReservedStock({
        productId: r.product, size: r.size || '', color: r.color || '',
        warehouseId: r.warehouse, quantity: r.quantity,
        referenceId: r.referenceId, actor: null, performedByType: 'SYSTEM',
      });
      // releaseReservedStock is a guarded no-op when nothing is held —
      // count only rows that actually flipped to RELEASED.
      const fresh = await StockReservation.findById(r._id).select('status').lean();
      if (fresh?.status === 'RELEASED') report.released += 1;
      else report.errors.push({ reservation: String(r._id), error: 'nothing held — left ACTIVE for review' });
    } catch (e) {
      report.errors.push({ reservation: String(r._id), error: e.message });
    }
  }
  return report;
};

export const releaseReservedStock = async ({ productId, size = '', color = '', warehouseId = null, quantity, referenceId, actor = null, performedByType = 'HUMAN' }) => {
  const seed = await ensureStock({ productId, size, color, warehouseId });
  const doc = await InventoryStock.findOneAndUpdate(
    { _id: seed._id, reserved: { $gte: quantity } },
    { $inc: { reserved: -quantity, available: quantity } },
    { new: true }
  );
  if (!doc) return seed; // nothing reserved — idempotent no-op
  recompute(doc);
  await doc.save();
  const { default: StockReservation } = await import('../../models/StockReservation.js');
  await StockReservation.updateMany(
    { referenceType: 'ORDER', referenceId, status: 'ACTIVE' },
    { $set: { status: 'RELEASED', releasedAt: new Date() } }
  );
  await logInventoryAction({ action: 'STOCK_RELEASED', actor, performedByType, entityType: 'InventoryStock', entityId: doc._id, newValue: { sku: seed.sku, quantity }, metadata: { referenceId } });
  await syncProductStock(productId);
  return doc;
};

// deductStock: confirmed sale — removes from onHand AND reserved (reserved path)
// or straight from onHand (direct-sale path, e.g. storefront checkout).
export const deductStock = async ({ productId, size = '', color = '', warehouseId = null, quantity, referenceId, idempotencyKey = '', actor = null, performedByType = 'HUMAN', fromReserved = false }) => {
  // Per-LINE key: one shared key per order would treat the 2nd..nth line as a
  // duplicate and silently skip its deduct. Legacy fallback covers pre-fix rows.
  const key = idempotencyKey || `SALE:ORDER:${referenceId}:${productId}:${size || ''}:${color || ''}`;
  const legacyKey = `SALE:ORDER:${referenceId}`;
  const dup = await StockMovement.findOne({ idempotencyKey: { $in: [key, legacyKey] } });
  if (dup) return { duplicate: true };
  const seed = await ensureStock({ productId, size, color, warehouseId });
  const filter = fromReserved
    ? { _id: seed._id, reserved: { $gte: quantity } }
    : { _id: seed._id, available: { $gte: quantity } };
  const inc = fromReserved ? { onHand: -quantity, reserved: -quantity } : { onHand: -quantity, available: -quantity };
  const before = (await InventoryStock.findById(seed._id))?.onHand || 0;
  const doc = await InventoryStock.findOneAndUpdate(filter, { $inc: inc }, { new: true });
  if (!doc) {
    const fresh = await InventoryStock.findById(seed._id);
    throw INSUFFICIENT(seed.sku, quantity, fromReserved ? fresh?.reserved || 0 : fresh?.available || 0);
  }
  recompute(doc);
  await doc.save();
  if (fromReserved) {
    const { default: StockReservation } = await import('../../models/StockReservation.js');
    await StockReservation.updateMany({ referenceType: 'ORDER', referenceId, status: 'ACTIVE' }, { $set: { status: 'CONFIRMED' } });
  }
  await recordMovement({
    product: productId, variantKey: seed.variantKey, sku: seed.sku, warehouse: seed.warehouse,
    type: 'SALE', quantity: -quantity, beforeQuantity: before, afterQuantity: doc.onHand,
    referenceType: 'ORDER', referenceId, idempotencyKey: key, performedBy: actor?._id || null, performedByType,
  });
  await Product.findByIdAndUpdate(productId, { $inc: { soldCount: quantity } });
  await logInventoryAction({ action: 'STOCK_DEDUCTED', actor, performedByType, entityType: 'InventoryStock', entityId: doc._id, newValue: { sku: seed.sku, quantity }, metadata: { referenceId } });
  await syncProductStock(productId);
  return { duplicate: false, doc };
};

// returnStock: cancelled order → put units back (idempotent per order).
export const returnStock = async ({ productId, size = '', color = '', warehouseId = null, quantity, referenceId, idempotencyKey = '', actor = null, performedByType = 'HUMAN' }) => {
  // Per-LINE key (same reason as deductStock): every cancelled line restocks.
  const key = idempotencyKey || `CANCEL:ORDER:${referenceId}:${productId}:${size || ''}:${color || ''}`;
  const legacyKey = `CANCEL:ORDER:${referenceId}`;
  const dup = await StockMovement.findOne({ idempotencyKey: { $in: [key, legacyKey] } });
  if (dup) return { duplicate: true };
  const seed = await ensureStock({ productId, size, color, warehouseId });
  const before = seed.onHand;
  const doc = await InventoryStock.findOneAndUpdate(
    { _id: seed._id },
    { $inc: { onHand: quantity, available: quantity } },
    { new: true }
  );
  recompute(doc);
  await doc.save();
  await recordMovement({
    product: productId, variantKey: seed.variantKey, sku: seed.sku, warehouse: seed.warehouse,
    type: 'RETURN', quantity, beforeQuantity: before, afterQuantity: doc.onHand,
    referenceType: 'ORDER', referenceId, idempotencyKey: key, performedBy: actor?._id || null, performedByType,
  });
  await Product.findByIdAndUpdate(productId, { $inc: { soldCount: -quantity } });
  await logInventoryAction({ action: 'RETURN_RESTOCKED', actor, performedByType, entityType: 'InventoryStock', entityId: doc._id, newValue: { sku: seed.sku, quantity }, metadata: { referenceId } });
  await syncProductStock(productId);
  return { duplicate: false, doc };
};

// adjustStock: manual correction — reason mandatory, negative stock blocked.
export const adjustStock = async ({ productId, size = '', color = '', warehouseId = null, quantity, bucket = 'onHand', reason, actor = null, performedByType = 'HUMAN', referenceId = '' }) => {
  if (!reason) {
    const e = new Error('Adjustment reason is required');
    e.statusCode = 400;
    throw e;
  }
  const seed = await ensureStock({ productId, size, color, warehouseId });
  const field = ['damaged', 'lost'].includes(bucket) ? bucket : 'onHand';
  const before = seed[field];
  if (before + quantity < 0) {
    const e = new Error('Adjustment would make stock negative');
    e.statusCode = 400;
    e.code = 'NEGATIVE_STOCK';
    throw e;
  }
  const doc = await InventoryStock.findOneAndUpdate(
    { _id: seed._id },
    { $inc: { [field]: quantity, available: field === 'onHand' ? quantity : -quantity } },
    { new: true }
  );
  recompute(doc);
  await doc.save();
  await recordMovement({
    product: productId, variantKey: seed.variantKey, sku: seed.sku, warehouse: seed.warehouse,
    type: quantity >= 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', quantity,
    beforeQuantity: before, afterQuantity: doc[field],
    referenceType: 'ADJUSTMENT', referenceId, reason, performedBy: actor?._id || null, performedByType,
  });
  await logInventoryAction({ action: 'STOCK_ADJUSTED', actor, performedByType, entityType: 'InventoryStock', entityId: doc._id, oldValue: { [field]: before }, newValue: { [field]: doc[field] }, reason });
  await syncProductStock(productId);
  await maybeRaiseAlerts(doc, actor);
  return doc;
};

// Combo sale: decrement each constituent product (qty × combo quantity).
export const deductComboStock = async ({ comboId, quantity, referenceId, actor = null, performedByType = 'SYSTEM' }) => {
  const Combo = (await import('../../models/Combo.js')).default;
  const combo = await Combo.findById(comboId).populate('items.product', '_id');
  if (!combo) return;
  for (const line of combo.items || []) {
    const pid = line.product?._id || line.product;
    if (!pid) continue;
    await deductStock({
      productId: pid, quantity: (line.quantity || 1) * quantity,
      referenceId, actor, performedByType,
    });
  }
};

export const returnComboStock = async ({ comboId, quantity, referenceId, actor = null, performedByType = 'SYSTEM' }) => {
  const Combo = (await import('../../models/Combo.js')).default;
  const combo = await Combo.findById(comboId).populate('items.product', '_id');
  if (!combo) return;
  for (const line of combo.items || []) {
    const pid = line.product?._id || line.product;
    if (!pid) continue;
    await returnStock({
      productId: pid, quantity: (line.quantity || 1) * quantity,
      referenceId, actor, performedByType,
    });
  }
};

export const maybeRaiseAlerts = async (doc, actor = null) => {
  const { default: InventoryAlert } = await import('../../models/InventoryAlert.js');
  const open = (type) => InventoryAlert.findOne({ type, product: doc.product, warehouse: doc.warehouse, status: 'ACTIVE' });
  if (doc.status === 'OUT_OF_STOCK' && !(await open('OUT_OF_STOCK'))) {
    const alert = await InventoryAlert.create({ type: 'OUT_OF_STOCK', product: doc.product, sku: doc.sku, warehouse: doc.warehouse, message: `${doc.sku || 'Product'} is out of stock` });
    // Phone dispatch is best-effort — never blocks the stock flow.
    try {
      const { dispatchCriticalAlert } = await import('../alertDispatchService.js');
      await dispatchCriticalAlert(alert);
    } catch (e) {
      console.error('[alert-dispatch]', e.message);
    }
  }
  if (doc.status === 'LOW_STOCK' && !(await open('LOW_STOCK'))) {
    await InventoryAlert.create({ type: 'LOW_STOCK', product: doc.product, sku: doc.sku, warehouse: doc.warehouse, message: `${doc.sku || 'Product'} is low (${doc.available} left)` });
  }
  if (doc.status === 'IN_STOCK') {
    await InventoryAlert.updateMany(
      { product: doc.product, warehouse: doc.warehouse, status: 'ACTIVE', type: { $in: ['LOW_STOCK', 'OUT_OF_STOCK'] } },
      { $set: { status: 'RESOLVED' } }
    );
  }
};

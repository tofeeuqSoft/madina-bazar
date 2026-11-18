import Warehouse from '../models/Warehouse.js';
import InventoryStock from '../models/InventoryStock.js';
import StockAdjustment from '../models/StockAdjustment.js';
import WarehouseTransfer from '../models/WarehouseTransfer.js';
import InventoryBatch from '../models/InventoryBatch.js';
import InventoryAlert from '../models/InventoryAlert.js';
import InventoryAuditLog from '../models/InventoryAuditLog.js';
import Return from '../models/Return.js';
import Purchase from '../models/Purchase.js';
import Settings from '../models/Settings.js';
import {
  ensureStock, checkAvailable, releaseReservedStock, adjustStock,
} from '../services/inventory/stockService.js';
import { createTransfer as createTransferSvcFn, approveTransfer as approveTransferSvcFn, receiveTransfer as receiveTransferSvcFn } from '../services/inventory/transferService.js';
import { receivePurchase } from '../services/inventory/purchaseReceivingService.js';
import { inspectReturn as inspectReturnSvcFn } from '../services/inventory/returnInventoryService.js';
import { refreshExpiryStatuses } from '../services/inventory/expiryService.js';
import { logInventoryAction } from '../services/inventory/inventoryAuditService.js';
import {
  stockList, movementList, dashboard, valuation,
  StockReservation,
} from '../services/inventory/inventoryQueryService.js';

const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const ipOf = (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '';

export const getDashboard = asyncH(async (req, res) => {
  res.json({ success: true, data: await dashboard() });
});

// Tab/sidebar badge counts. Snapshot (see generatedAt) — money math must
// always use fresh reads (valuation/reports), never these cached numbers.
// Each field is included ONLY if the caller may view that domain.
export const getStockCounts = asyncH(async (req, res) => {
  const { hasPermission } = await import('../utils/permissions.js');
  const u = req.user;
  const out = { generatedAt: new Date().toISOString() };
  const jobs = [];
  if (hasPermission(u, 'inventory.stock.view')) {
    jobs.push(
      InventoryStock.countDocuments({}).then((v) => { out.all = v; }),
      InventoryStock.countDocuments({ status: 'LOW_STOCK' }).then((v) => { out.low = v; }),
      InventoryStock.countDocuments({ status: 'OUT_OF_STOCK' }).then((v) => { out.out = v; }),
      StockAdjustment.countDocuments({ status: 'PENDING' }).then((v) => { out.pendingAdjustments = v; }),
    );
  }
  if (hasPermission(u, 'inventory.damage.view')) {
    jobs.push(
      InventoryStock.countDocuments({ $or: [{ damaged: { $gt: 0 } }, { lost: { $gt: 0 } }] }).then((v) => { out.damagedIssues = v; }),
    );
  }
  if (hasPermission(u, 'inventory.alert.view')) {
    jobs.push(
      InventoryAlert.countDocuments({ status: 'ACTIVE' }).then((v) => { out.activeAlerts = v; }),
    );
  }
  await Promise.all(jobs);
  res.json({ success: true, data: out });
});

export const listStock = asyncH(async (req, res) => {
  const [data, total] = await stockList(req.query);
  // Same storefront link as catalog table — Stock Overview "Store" column
  const base = (process.env.CLIENT_URL || '').replace(/\/$/, '');
  res.json({ success: true, total, data: data.map((r) => ({ ...r.toObject(), storeUrl: r.product ? `${base}/product/${r.product.slug || r.product._id}` : '' })) });
});

export const getStockOne = asyncH(async (req, res) => {
  const doc = await InventoryStock.findById(req.params.id).populate('product', 'name sku costPrice regularPrice').populate('warehouse', 'name code');
  if (!doc) return res.status(404).json({ success: false, message: 'Stock record not found', code: 'INV_NOT_FOUND' });
  res.json({ success: true, data: doc });
});

export const checkStock = asyncH(async (req, res) => {
  const { productId, size, color, warehouseId, quantity } = req.query;
  if (!productId || !quantity) return res.status(400).json({ success: false, message: 'productId and quantity are required' });
  res.json({ success: true, data: await checkAvailable({ productId, size, color, warehouseId, quantity: Number(quantity) }) });
});

export const listMovements = asyncH(async (req, res) => {
  const [data, total] = await movementList(req.query);
  // Whitelist ONLY — never leak metadata (supplier cost/evidence), internal
  // reasons, idempotency keys, actor ids or __v to the browser. Full detail
  // stays server-side for audit roles via audit-logs.
  const safe = data.map((m) => {
    const o = typeof m.toObject === 'function' ? m.toObject() : m;
    return {
      _id: o._id,
      createdAt: o.createdAt,
      type: o.type,
      quantity: o.quantity,
      beforeQuantity: o.beforeQuantity,
      afterQuantity: o.afterQuantity,
      sku: o.sku,
      variantKey: o.variantKey,
      product: o.product ? { _id: o.product._id, name: o.product.name, sku: o.product.sku } : null,
      warehouse: o.warehouse ? { _id: o.warehouse._id, name: o.warehouse.name, code: o.warehouse.code } : null,
      referenceType: o.referenceType,
      referenceId: o.referenceId,
      performedByType: o.performedByType,
    };
  });
  res.json({ success: true, total, data: safe });
});

const archiveCutoff = (days) => new Date(Date.now() - Number(days) * 86400000);

// How many movement rows are old enough to archive (nothing is touched).
export const previewMovementArchive = asyncH(async (req, res) => {
  const days = Number(req.query.olderThanDays || 365);
  if (!Number.isFinite(days) || days < 90) {
    return res.status(400).json({ success: false, message: 'olderThanDays must be at least 90', code: 'INV_ARCHIVE_VALIDATION' });
  }
  const { default: StockMovement } = await import('../models/StockMovement.js');
  const eligible = await StockMovement.countDocuments({ archived: { $ne: true }, createdAt: { $lt: archiveCutoff(days) } });
  res.json({ success: true, data: { eligible, cutoff: archiveCutoff(days) } });
});

// Full-record CSV of archivable rows — download BEFORE archiving (UI enforces order).
export const exportMovements = asyncH(async (req, res) => {
  const days = Number(req.query.olderThanDays || 365);
  if (!Number.isFinite(days) || days < 90) {
    return res.status(400).json({ success: false, message: 'olderThanDays must be at least 90', code: 'INV_ARCHIVE_VALIDATION' });
  }
  const { default: StockMovement } = await import('../models/StockMovement.js');
  const rows = await StockMovement.find({ archived: { $ne: true }, createdAt: { $lt: archiveCutoff(days) } })
    .populate('product', 'name sku').populate('warehouse', 'name code').populate('performedBy', 'name role')
    .sort({ createdAt: 1 }).limit(20000);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = ['createdAt,type,product,sku,warehouse,quantity,before,after,referenceType,referenceId,reason,performedBy,performedByType'];
  for (const m of rows) {
    lines.push([m.createdAt?.toISOString(), m.type, esc(m.product?.name), m.sku, m.warehouse?.code, m.quantity, m.beforeQuantity, m.afterQuantity, m.referenceType, m.referenceId, esc(m.reason), esc(m.performedBy?.name), m.performedByType].join(','));
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="movements-archive-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(lines.join('\n'));
});

// Soft-archive only: rows stay in DB (restorable, still counted in reports),
// operational lists stop reading them. NEVER hard-delete.
export const archiveMovements = asyncH(async (req, res) => {
  const days = Number(req.body.olderThanDays || 365);
  if (!Number.isFinite(days) || days < 90) {
    return res.status(400).json({ success: false, message: 'olderThanDays must be at least 90', code: 'INV_ARCHIVE_VALIDATION' });
  }
  if (req.body.exportConfirmed !== true) {
    return res.status(400).json({ success: false, message: 'Download the CSV export first (exportConfirmed=true)', code: 'INV_ARCHIVE_VALIDATION' });
  }
  const { default: StockMovement } = await import('../models/StockMovement.js');
  const r = await StockMovement.updateMany(
    { archived: { $ne: true }, createdAt: { $lt: archiveCutoff(days) } },
    { $set: { archived: true, archivedAt: new Date() } },
  );
  await logInventoryAction({ action: 'MOVEMENTS_ARCHIVED', actor: req.user, entityType: 'StockMovement', entityId: null, newValue: { archived: r.modifiedCount, olderThanDays: days }, reason: 'History archive (soft, restorable)', ip: ipOf(req) });
  res.json({ success: true, data: { archived: r.modifiedCount } });
});

export const getForecast = asyncH(async (req, res) => {
  const { forecastDemand } = await import('../services/demandForecastService.js');
  res.json({ success: true, data: await forecastDemand({ days: req.query.days, leadTimeDays: req.query.leadTimeDays, limit: req.query.limit }) });
});

export const getDeadStock = asyncH(async (req, res) => {
  const { deadStockReport } = await import('../services/demandForecastService.js');
  res.json({ success: true, data: await deadStockReport({ days: req.query.days, limit: req.query.limit }) });
});

export const clearanceMarkdown = asyncH(async (req, res) => {
  const pct = Number(req.body.pct);
  if (!Number.isFinite(pct) || pct < 5 || pct > 70) {
    return res.status(400).json({ success: false, message: 'pct must be 5–70', code: 'INV_CATALOG_VALIDATION' });
  }
  const Product = (await import('../models/Product.js')).default;
  const p = await Product.findById(req.body.productId).select('regularPrice salePrice name sku');
  if (!p) return res.status(404).json({ success: false, message: 'Product not found' });
  const newSale = Math.max(1, Math.floor((p.regularPrice || 0) * (1 - pct / 100)));
  const { updateCatalogItem } = await import('../services/inventory/catalogService.js');
  const { product } = await updateCatalogItem({ productId: p._id, patch: { salePrice: newSale }, actor: req.user, force: true });
  const { logInventoryAction } = await import('../services/inventory/inventoryAuditService.js');
  await logInventoryAction({ action: 'STOCK_ADJUSTED', actor: req.user, entityType: 'Product', entityId: p._id, oldValue: { salePrice: p.salePrice }, newValue: { salePrice: newSale }, reason: `Clearance markdown ${pct}% (dead stock)`, ip: req.ip });
  res.json({ success: true, data: { productId: p._id, name: p.name, sku: p.sku, oldSale: p.salePrice, newSale, pct } });
});

export const runReconcile = asyncH(async (req, res) => {
  const { reconcileInventory } = await import('../services/inventory/reconcileService.js');
  const report = await reconcileInventory({ actor: req.user });
  res.json({ success: true, data: report });
});

export const listReservations = asyncH(async (req, res) => {
  const q = {};
  if (req.query.status) q.status = req.query.status;
  if (req.query.referenceId) q.referenceId = req.query.referenceId;
  const [data, total] = await Promise.all([
    StockReservation.find(q).populate('product', 'name sku').populate('warehouse', 'name code').sort({ createdAt: -1 }).limit(50),
    StockReservation.countDocuments(q),
  ]);
  res.json({ success: true, total, data });
});

export const sweepReservations = asyncH(async (req, res) => {
  const { sweepExpiredReservations } = await import('../services/inventory/stockService.js');
  res.json({ success: true, data: await sweepExpiredReservations({}) });
});

export const releaseReservation = asyncH(async (req, res) => {
  const r = await StockReservation.findById(req.params.id);
  if (!r) return res.status(404).json({ success: false, message: 'Reservation not found' });
  if (r.status !== 'ACTIVE') return res.json({ success: true, data: r, message: 'Already released/confirmed' });
  await releaseReservedStock({ productId: r.product, size: r.size || '', color: r.color || '', warehouseId: r.warehouse, quantity: r.quantity, referenceId: r.referenceId, actor: req.user });
  res.json({ success: true, message: 'Reservation released' });
});

// ---- Adjustments (large ones need approval; approver ≠ creator) ----
export const listAdjustments = asyncH(async (req, res) => {
  const q = {};
  if (req.query.status) q.status = req.query.status;
  const [data, total] = await Promise.all([
    StockAdjustment.find(q).populate('product', 'name sku').populate('warehouse', 'name code').sort({ createdAt: -1 }).limit(50),
    StockAdjustment.countDocuments(q),
  ]);
  res.json({ success: true, total, data });
});

export const createAdjustment = asyncH(async (req, res) => {
  const { productId, size, color, warehouseId, quantity, bucket, adjustmentType, reason } = req.body;
  if (!productId || quantity === undefined) return res.status(400).json({ success: false, message: 'productId and quantity are required', code: 'INV_VALIDATION' });
  if (!reason) return res.status(400).json({ success: false, message: 'Adjustment reason is required', code: 'INV_REASON_REQUIRED' });
  const settings = (await Settings.findOne()) || {};
  const threshold = settings.adjustmentApprovalThreshold || 100;
  const needsApproval = Math.abs(Number(quantity)) >= threshold;
  const adj = await StockAdjustment.create({
    product: productId, size: size || '', color: color || '',
    warehouse: warehouseId || (await ensureStock({ productId })).warehouse,
    quantity: Number(quantity), bucket: bucket || 'onHand',
    adjustmentType: adjustmentType || 'COUNT_CORRECTION', reason,
    requiresApproval: needsApproval, status: needsApproval ? 'PENDING' : 'APPROVED',
    createdBy: req.user._id,
  });
  if (!needsApproval) {
    await adjustStock({ productId, size, color, warehouseId: adj.warehouse, quantity: Number(quantity), bucket: adj.bucket || 'onHand', reason, actor: req.user, referenceId: String(adj._id) });
  }
  await logInventoryAction({ action: 'STOCK_ADJUSTED', actor: req.user, entityType: 'StockAdjustment', entityId: adj._id, newValue: { status: adj.status, quantity }, reason, ip: ipOf(req) });
  res.status(201).json({ success: true, data: adj });
});

export const approveAdjustment = asyncH(async (req, res) => {
  const adj = await StockAdjustment.findById(req.params.id);
  if (!adj) return res.status(404).json({ success: false, message: 'Adjustment not found' });
  if (adj.status !== 'PENDING') return res.status(400).json({ success: false, message: `Already ${adj.status}` });
  if (String(adj.createdBy) === String(req.user._id)) {
    return res.status(403).json({ success: false, message: 'You cannot approve your own adjustment', code: 'INV_SELF_APPROVAL' });
  }
  adj.status = 'APPROVED';
  adj.approvedBy = req.user._id;
  adj.approvedAt = new Date();
  await adj.save();
  await adjustStock({ productId: adj.product, warehouseId: adj.warehouse, quantity: adj.quantity, bucket: 'onHand', reason: adj.reason, actor: req.user, referenceId: String(adj._id) });
  await logInventoryAction({ action: 'STOCK_ADJUSTED', actor: req.user, entityType: 'StockAdjustment', entityId: adj._id, newValue: { status: 'APPROVED' }, ip: ipOf(req) });
  res.json({ success: true, data: adj });
});

export const rejectAdjustment = asyncH(async (req, res) => {
  const adj = await StockAdjustment.findById(req.params.id);
  if (!adj) return res.status(404).json({ success: false, message: 'Adjustment not found' });
  if (adj.status !== 'PENDING') return res.status(400).json({ success: false, message: `Already ${adj.status}` });
  adj.status = 'REJECTED';
  await adj.save();
  res.json({ success: true, data: adj });
});

// ---- Warehouses ----
export const listWarehouses = asyncH(async (req, res) => {
  res.json({ success: true, data: await Warehouse.find({}).sort({ isDefault: -1, name: 1 }) });
});

export const createWarehouse = asyncH(async (req, res) => {
  const code = (req.body.code || req.body.name || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20);
  const w = await Warehouse.create({ ...req.body, code });
  await logInventoryAction({ action: 'WAREHOUSE_CREATED', actor: req.user, entityType: 'Warehouse', entityId: w._id, newValue: { code }, ip: ipOf(req) });
  res.status(201).json({ success: true, data: w });
});

export const updateWarehouse = asyncH(async (req, res) => {
  const w = await Warehouse.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data: w });
});

export const deleteWarehouse = asyncH(async (req, res) => {
  const used = await InventoryStock.countDocuments({ warehouse: req.params.id, onHand: { $gt: 0 } });
  if (used > 0) return res.status(400).json({ success: false, message: 'Warehouse still holds stock — transfer it out first', code: 'INV_WAREHOUSE_NOT_EMPTY' });
  await Warehouse.findByIdAndUpdate(req.params.id, { status: 'INACTIVE' });
  res.json({ success: true, message: 'Warehouse deactivated (never hard-deleted)' });
});

// ---- Transfers ----
export const listTransfers = asyncH(async (req, res) => {
  const q = {};
  if (req.query.status) q.status = req.query.status;
  const [data, total] = await Promise.all([
    WarehouseTransfer.find(q).populate('fromWarehouse', 'name code').populate('toWarehouse', 'name code').sort({ createdAt: -1 }).limit(50),
    WarehouseTransfer.countDocuments(q),
  ]);
  res.json({ success: true, total, data });
});

export const createTransfer = asyncH(async (req, res) => {
  const t = await createTransferSvcFn({ items: req.body.items, fromWarehouse: req.body.fromWarehouse, toWarehouse: req.body.toWarehouse, reason: req.body.reason || '', actor: req.user });
  res.status(201).json({ success: true, data: t });
});

export const approveTransfer = asyncH(async (req, res) => {
  const t = await WarehouseTransfer.findById(req.params.id);
  if (!t) return res.status(404).json({ success: false, message: 'Transfer not found' });
  res.json({ success: true, data: await approveTransferSvcFn({ transfer: t, actor: req.user }) });
});

export const receiveTransfer = asyncH(async (req, res) => {
  const t = await WarehouseTransfer.findById(req.params.id);
  if (!t) return res.status(404).json({ success: false, message: 'Transfer not found' });
  res.json({ success: true, data: await receiveTransferSvcFn({ transfer: t, actor: req.user }) });
});

export const cancelTransfer = asyncH(async (req, res) => {
  const t = await WarehouseTransfer.findById(req.params.id);
  if (!t) return res.status(404).json({ success: false, message: 'Transfer not found' });
  if (!['REQUESTED'].includes(t.status)) return res.status(400).json({ success: false, message: `Cannot cancel ${t.status} transfer` });
  t.status = 'CANCELLED';
  await t.save();
  res.json({ success: true, data: t });
});

// ---- Purchase receiving ----
export const receivePurchaseOrder = asyncH(async (req, res) => {
  const p = await Purchase.findById(req.params.id);
  if (!p) return res.status(404).json({ success: false, message: 'Purchase not found' });
  const { accepted, damaged, warehouseId } = req.body;
  const acc = accepted || p.items.map((i) => ({ product: i.product, quantity: i.quantity, costPrice: i.costPrice }));
  await receivePurchase({ purchase: p, accepted: acc, damaged: damaged || [], warehouseId, actor: req.user });
  res.json({ success: true, data: p });
});

// ---- Returns: inspect + restock ----
export const listReturns = asyncH(async (req, res) => {
  const q = { type: 'SALE_RETURN' };
  if (req.query.status) q.status = req.query.status;
  const [data, total] = await Promise.all([
    Return.find(q).populate('order', 'orderNumber').sort({ createdAt: -1 }).limit(50),
    Return.countDocuments(q),
  ]);
  res.json({ success: true, total, data });
});

export const inspectReturn = asyncH(async (req, res) => {
  const r = await Return.findById(req.params.id);
  if (!r) return res.status(404).json({ success: false, message: 'Return not found' });
  const inspections = req.body.inspections || (r.items || []).map((i) => ({ product: i.product, quantity: i.quantity, condition: 'GOOD' }));
  const results = await inspectReturnSvcFn({ returnDoc: r, inspections, warehouseId: req.body.warehouseId, actor: req.user });
  res.json({ success: true, data: results });
});

// ---- Batches / expiry ----
export const listBatches = asyncH(async (req, res) => {
  const q = {};
  if (req.query.product) q.product = req.query.product;
  if (req.query.status) q.expiryStatus = req.query.status;
  const [data, total] = await Promise.all([
    InventoryBatch.find(q).populate('product', 'name sku').populate('warehouse', 'name code').sort({ expiryDate: 1 }).limit(100),
    InventoryBatch.countDocuments(q),
  ]);
  res.json({ success: true, data, total });
});

export const createBatch = asyncH(async (req, res) => {
  const b = await InventoryBatch.create(req.body);
  await logInventoryAction({ action: 'BATCH_CREATED', actor: req.user, entityType: 'InventoryBatch', entityId: b._id, newValue: { batchNumber: b.batchNumber }, ip: ipOf(req) });
  res.status(201).json({ success: true, data: b });
});

export const updateBatch = asyncH(async (req, res) => {
  const b = await InventoryBatch.findByIdAndUpdate(req.params.id, req.body, { new: true });
  await logInventoryAction({ action: 'BATCH_UPDATED', actor: req.user, entityType: 'InventoryBatch', entityId: req.params.id, newValue: req.body, ip: ipOf(req) });
  res.json({ success: true, data: b });
});

export const getExpiry = asyncH(async (req, res) => {
  await refreshExpiryStatuses();
  const days = Number(req.query.days || 30);
  const now = new Date();
  const [expired, expiring] = await Promise.all([
    InventoryBatch.find({ expiryStatus: 'EXPIRED' }).populate('product', 'name sku').limit(100),
    InventoryBatch.find({ expiryStatus: 'EXPIRING_SOON', expiryDate: { $lte: new Date(now.getTime() + days * 86400000) } }).populate('product', 'name sku').limit(100),
  ]);
  res.json({ success: true, data: { expired, expiringSoon: expiring, thresholdDays: days } });
});

// ---- Damaged / lost ----
export const listDamagedLost = asyncH(async (req, res) => {
  const [data, total] = await movementList({ type: req.query.kind === 'LOST' ? 'LOST' : 'DAMAGED', page: req.query.page, limit: req.query.limit });
  res.json({ success: true, total, data });
});

export const recordDamageLoss = asyncH(async (req, res) => {
  const { productId, size, color, warehouseId, quantity, kind, reason, evidence } = req.body;
  if (!productId || !quantity || !reason) return res.status(400).json({ success: false, message: 'productId, quantity and reason are required' });
  const doc = await adjustStock({
    productId, size, color, warehouseId, quantity: -Math.abs(Number(quantity)),
    bucket: kind === 'LOST' ? 'lost' : 'damaged', reason,
    actor: req.user, referenceId: evidence || '',
  });
  await logInventoryAction({ action: kind === 'LOST' ? 'LOSS_RECORDED' : 'DAMAGE_RECORDED', actor: req.user, entityType: 'InventoryStock', entityId: doc._id, newValue: { quantity, kind }, reason, metadata: { evidence }, ip: ipOf(req) });
  res.status(201).json({ success: true, data: doc });
});

// ---- Valuation / alerts / reports / audit / settings ----
export const getValuation = asyncH(async (req, res) => {
  const rows = await valuation();
  const { default: Product } = await import('../models/Product.js');
  const ids = rows.map((r) => r._id);
  const products = await Product.find({ _id: { $in: ids } }).select('name sku costPrice').lean();
  const map = new Map(products.map((p) => [String(p._id), p]));
  res.json({
    success: true,
    data: {
      // Valuation uses cost (averageCost), NEVER selling price.
      rows: rows.map((r) => ({ product: map.get(String(r._id)) || { _id: r._id }, available: r.available, value: Math.round(r.value) })),
      totalValue: Math.round(rows.reduce((s, r) => s + r.value, 0)),
    },
  });
});

export const listAlerts = asyncH(async (req, res) => {
  const q = {};
  if (req.query.status) q.status = req.query.status;
  else if (req.query.unacked === 'true') q.status = 'ACTIVE';
  if (req.query.type) q.type = req.query.type;
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 100);
  const [data, total] = await Promise.all([
    InventoryAlert.find(q).populate('product', 'name sku').populate('warehouse', 'name code').sort({ createdAt: -1 }).limit(limit),
    InventoryAlert.countDocuments(q),
  ]);
  res.json({ success: true, total, data });
});

export const ackAlert = asyncH(async (req, res) => {
  const a = await InventoryAlert.findByIdAndUpdate(req.params.id, { status: req.body.status || 'ACKNOWLEDGED' }, { new: true });
  res.json({ success: true, data: a });
});

export const getReports = asyncH(async (req, res) => {
  const { default: StockMovement } = await import('../models/StockMovement.js');
  const match = {};
  if (req.query.from || req.query.to) {
    match.createdAt = { ...(req.query.from ? { $gte: new Date(req.query.from) } : {}), ...(req.query.to ? { $lte: new Date(req.query.to) } : {}) };
  }
  const [byType, fast, slow] = await Promise.all([
    StockMovement.aggregate([{ $match: match }, { $group: { _id: '$type', count: { $sum: 1 }, qty: { $sum: '$quantity' } } }]),
    StockMovement.aggregate([{ $match: { ...match, type: 'SALE' } }, { $group: { _id: '$product', sold: { $sum: { $abs: '$quantity' } } } }, { $sort: { sold: -1 } }, { $limit: 10 }]),
    InventoryStock.find({}).populate('product', 'name sku').sort({ updatedAt: 1 }).limit(10).select('product available updatedAt'),
  ]);
  res.json({ success: true, data: { byType, fastMoving: fast, slowMoving: slow } });
});

export const exportCsv = asyncH(async (req, res) => {
  const [rows] = await stockList({ ...req.query, page: 1, limit: 2000 });
  const header = ['sku', 'product', 'warehouse', 'onHand', 'reserved', 'available', 'damaged', 'lost', 'status'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([r.sku, `"${(r.product?.name || '').replace(/"/g, '""')}"`, r.warehouse?.code || '', r.onHand, r.reserved, r.available, r.damaged, r.lost, r.status].join(','));
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="inventory.csv"');
  res.send(lines.join('\n'));
});

export const getAuditLogs = asyncH(async (req, res) => {
  const q = {};
  if (req.query.action) q.action = req.query.action;
  // Archived rows stay queryable (?archived=true) but leave the live list.
  if (req.query.archived === 'true') q.archived = true;
  else q.archived = { $ne: true };
  res.json({ success: true, data: await InventoryAuditLog.find(q).populate('actor', 'name role').sort({ createdAt: -1 }).limit(200) });
});

const auditCutoff = (days) => new Date(Date.now() - Number(days) * 86400000);

// Audit retention is stricter than movements: min 365 days, nothing recent.
export const exportAuditLogsCsv = asyncH(async (req, res) => {
  const q = {};
  if (req.query.action) q.action = req.query.action;
  if (req.query.archived === 'true') q.archived = true;
  else if (req.query.archived !== 'all') q.archived = { $ne: true };
  const rows = await InventoryAuditLog.find(q).populate('actor', 'name role').sort({ createdAt: 1 }).limit(20000);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = ['createdAt,action,actor,actorRole,entityType,entityId,reason,ip,archived'];
  for (const l of rows) {
    lines.push([l.createdAt?.toISOString(), l.action, esc(l.actor?.name), l.actorRole, l.entityType, l.entityId, esc(l.reason), l.ip, l.archived ? 'yes' : 'no'].join(','));
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(lines.join('\n'));
});

export const previewAuditArchive = asyncH(async (req, res) => {
  const days = Number(req.query.olderThanDays || 730);
  if (!Number.isFinite(days) || days < 365) {
    return res.status(400).json({ success: false, message: 'olderThanDays must be at least 365', code: 'INV_ARCHIVE_VALIDATION' });
  }
  const eligible = await InventoryAuditLog.countDocuments({ archived: { $ne: true }, createdAt: { $lt: auditCutoff(days) } });
  res.json({ success: true, data: { eligible, cutoff: auditCutoff(days) } });
});

export const exportAuditLogs = asyncH(async (req, res) => {
  const days = Number(req.query.olderThanDays || 730);
  if (!Number.isFinite(days) || days < 365) {
    return res.status(400).json({ success: false, message: 'olderThanDays must be at least 365', code: 'INV_ARCHIVE_VALIDATION' });
  }
  const rows = await InventoryAuditLog.find({ archived: { $ne: true }, createdAt: { $lt: auditCutoff(days) } })
    .populate('actor', 'name role').sort({ createdAt: 1 }).limit(20000);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = ['createdAt,action,actor,actorRole,entityType,entityId,reason,ip'];
  for (const l of rows) {
    lines.push([l.createdAt?.toISOString(), l.action, esc(l.actor?.name), l.actorRole, l.entityType, l.entityId, esc(l.reason), l.ip].join(','));
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="audit-archive-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(lines.join('\n'));
});

export const archiveAuditLogs = asyncH(async (req, res) => {
  const days = Number(req.body.olderThanDays || 730);
  if (!Number.isFinite(days) || days < 365) {
    return res.status(400).json({ success: false, message: 'olderThanDays must be at least 365', code: 'INV_ARCHIVE_VALIDATION' });
  }
  if (req.body.exportConfirmed !== true) {
    return res.status(400).json({ success: false, message: 'Download the CSV export first (exportConfirmed=true)', code: 'INV_ARCHIVE_VALIDATION' });
  }
  const r = await InventoryAuditLog.updateMany(
    { archived: { $ne: true }, createdAt: { $lt: auditCutoff(days) } },
    { $set: { archived: true, archivedAt: new Date() } },
  );
  // The run itself is a fresh (live) entry — the chain never breaks.
  await logInventoryAction({ action: 'AUDIT_ARCHIVED', actor: req.user, entityType: 'InventoryAuditLog', entityId: '', newValue: { archived: r.modifiedCount, olderThanDays: days }, reason: 'Audit history archive (soft, restorable)', ip: ipOf(req) });
  res.json({ success: true, data: { archived: r.modifiedCount } });
});

export const getSettings = asyncH(async (req, res) => {
  const s = (await Settings.findOne()) || {};
  res.json({
    success: true,
    data: {
      valuationMethod: s.inventoryValuationMethod || 'WEIGHTED_AVERAGE',
      fulfillmentMethod: s.inventoryFulfillmentMethod || 'FEFO',
      expirySoonDays: s.expirySoonDays ?? 30,
      largeAdjustmentThreshold: s.largeAdjustmentThreshold ?? 50,
      adjustmentApprovalThreshold: s.adjustmentApprovalThreshold ?? 100,
      movementArchiveAfterDays: s.movementArchiveAfterDays ?? 365,
      auditArchiveAfterDays: s.auditArchiveAfterDays ?? 730,
    },
  });
});

export const updateSettings = asyncH(async (req, res) => {
  let s = await Settings.findOne();
  if (!s) s = new Settings({});
  const map = { valuationMethod: 'inventoryValuationMethod', fulfillmentMethod: 'inventoryFulfillmentMethod', expirySoonDays: 'expirySoonDays', largeAdjustmentThreshold: 'largeAdjustmentThreshold', adjustmentApprovalThreshold: 'adjustmentApprovalThreshold', movementArchiveAfterDays: 'movementArchiveAfterDays', auditArchiveAfterDays: 'auditArchiveAfterDays' };
  for (const [k, field] of Object.entries(map)) {
    if (req.body[k] !== undefined) s[field] = req.body[k];
  }
  await s.save();
  res.json({ success: true, data: s });
});

// ---- Catalog maintenance (category table, bulk edit, CSV import) ----
export const postCatalogCreate = asyncH(async (req, res) => {
  const { name, category, subcategory, brand, regularPrice, salePrice, costPrice, stock, minStock, unit, sku, size, color, sizes, colors, description, images, videos, isFeatured, isGrocery, vatExempt, isActive } = req.body;
  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Product name is required', code: 'INV_CATALOG_VALIDATION' });
  }
  if (!category) {
    return res.status(400).json({ success: false, message: 'Category is required', code: 'INV_CATALOG_VALIDATION' });
  }
  if (regularPrice === undefined || Number(regularPrice) < 0) {
    return res.status(400).json({ success: false, message: 'Valid regular price is required', code: 'INV_CATALOG_VALIDATION' });
  }
  const Category = (await import('../models/Category.js')).default;
  const Product = (await import('../models/Product.js')).default;
  const cat = await Category.findById(category);
  if (!cat) return res.status(400).json({ success: false, message: 'Category not found', code: 'INV_CATALOG_VALIDATION' });
  if (subcategory && !(await Category.findById(subcategory))) {
    return res.status(400).json({ success: false, message: 'Subcategory not found', code: 'INV_CATALOG_VALIDATION' });
  }
  const slugify = (await import('slugify')).default;
  let slug = slugify(String(name), { lower: true, strict: true });
  if (await Product.findOne({ slug })) slug = `${slug}-${Date.now().toString().slice(-4)}`;
  if (sku && await Product.findOne({ sku })) {
    return res.status(400).json({ success: false, message: 'SKU already exists', code: 'INV_CATALOG_DUPLICATE' });
  }
  const finalSku = sku || `MB-${Date.now().toString().slice(-8)}`;
  // Normalize sizes/colors (accept arrays or comma strings, like ProductForm)
  const splitList = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
  const normSizes = Array.isArray(sizes) ? sizes.flatMap((s) => splitList(s)) : splitList(size || sizes);
  const normColors = Array.isArray(colors)
    ? colors.map((c) => (typeof c === 'string' ? { name: c.trim() } : { name: String(c?.name || '').trim(), code: c?.code || '' })).filter((c) => c.name)
    : splitList(color || colors).map((n) => ({ name: n }));
  // Media: same provider-agnostic URL rules as CSV import
  const { validMediaUrl, detectProvider } = await import('../services/inventory/catalogService.js');
  const normImages = (Array.isArray(images) ? images : []).map((i) => (typeof i === 'string' ? i : i?.url)).filter(Boolean);
  const normVideos = (Array.isArray(videos) ? videos : []).map((v) => (typeof v === 'string' ? v : v?.url)).filter(Boolean);
  if (normImages.length > 5) {
    return res.status(400).json({ success: false, message: 'Max 5 images', code: 'INV_CATALOG_VALIDATION' });
  }
  if (normVideos.length > 1) {
    return res.status(400).json({ success: false, message: 'Max 1 video', code: 'INV_CATALOG_VALIDATION' });
  }
  const badImg = normImages.find((u) => !validMediaUrl(u, 'image'));
  const badVid = normVideos.find((u) => !validMediaUrl(u, 'video'));
  if (badImg || badVid) {
    return res.status(400).json({ success: false, message: `Invalid media URL: ${badImg || badVid}`, code: 'INV_CATALOG_VALIDATION' });
  }
  const doc = await Product.create({
    name: String(name).trim(),
    slug,
    category,
    subcategory: subcategory || null,
    isGrocery: isGrocery !== undefined ? !!isGrocery : undefined,
    brand: brand || '',
    regularPrice: Number(regularPrice),
    salePrice: salePrice !== undefined && salePrice !== '' ? Number(salePrice) : Number(regularPrice),
    costPrice: costPrice !== undefined && costPrice !== '' ? Number(costPrice) : 0,
    sizes: normSizes,
    colors: normColors,
    images: normImages.map((url, i) => ({ url, isMain: i === 0, provider: detectProvider(url) })),
    videos: normVideos.map((url) => ({ url, provider: detectProvider(url) })),
    description: description || '',
    stock: 0, // opening units enter via the ledger below (never silent)
    minStock: Math.max(0, Number(minStock ?? 5)),
    unit: unit || 'Piece',
    vatExempt: !!vatExempt,
    isActive: isActive !== false,
    isFeatured: !!isFeatured,
    sku: finalSku,
  });
  const { ensureStock, adjustStock } = await import('../services/inventory/stockService.js');
  await ensureStock({ productId: doc._id });
  const opening = Math.max(0, Number(stock) || 0);
  if (opening > 0) {
    await adjustStock({ productId: doc._id, quantity: opening, bucket: 'onHand', reason: 'Opening stock (single add)', actor: req.user, referenceId: `CATALOG:${doc._id}` });
  }
  const { logInventoryAction } = await import('../services/inventory/inventoryAuditService.js');
  await logInventoryAction({ action: 'STOCK_ADJUSTED', actor: req.user, entityType: 'Product', entityId: doc._id, newValue: { created: doc.name }, reason: 'Catalog single add', ip: req.ip });
  res.status(201).json({ success: true, data: doc });
});
export const getCatalog = asyncH(async (req, res) => {
  const { catalogTable } = await import('../services/inventory/catalogService.js');
  const { data, total } = await catalogTable({ category: req.query.category, search: req.query.search, page: req.query.page, limit: req.query.limit });
  // Append storefront link (product page) for instant visual verification
  const base = (process.env.CLIENT_URL || '').replace(/\/$/, '');
  res.json({ success: true, total, data: data.map((p) => ({ ...p, storeUrl: `${base}/product/${p.slug || p._id}` })) });
});

export const patchCatalogItem = asyncH(async (req, res) => {
  const { updateCatalogItem } = await import('../services/inventory/catalogService.js');
  res.json({ success: true, data: await updateCatalogItem({ productId: req.params.id, patch: req.body.patch || req.body, actor: req.user, force: req.body.force === true }) });
});

export const postCatalogBulk = asyncH(async (req, res) => {
  const { bulkCatalogEdit } = await import('../services/inventory/catalogService.js');
  res.json({ success: true, data: await bulkCatalogEdit({ ids: req.body.ids || [], op: req.body.op, value: req.body.value, actor: req.user, force: req.body.force === true }) });
});

export const postCatalogValidate = asyncH(async (req, res) => {
  const { parseCSV, validateImport } = await import('../services/inventory/catalogService.js');
  const text = req.body.csv || '';
  if (!text || text.length > 2 * 1024 * 1024) {
    return res.status(400).json({ success: false, message: 'CSV text required (max 2MB)', code: 'INV_CSV_REQUIRED' });
  }
  const { headers, rows } = parseCSV(text);
  const objs = rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
  res.json({ success: true, data: await validateImport({ rows: objs, fileName: req.body.fileName || 'upload.csv', actor: req.user }) });
});

export const postCatalogConfirm = asyncH(async (req, res) => {
  const { confirmImport } = await import('../services/inventory/catalogService.js');
  res.json({ success: true, data: await confirmImport({ batchId: req.body.batchId, force: req.body.force === true, actor: req.user }) });
});

export const postCatalogRollback = asyncH(async (req, res) => {
  const { rollbackImport } = await import('../services/inventory/catalogService.js');
  res.json({ success: true, data: await rollbackImport({ batchId: req.params.batchId, actor: req.user }) });
});

export const listCatalogBatches = asyncH(async (req, res) => {
  const ImportBatch = (await import('../models/ImportBatch.js')).default;
  const [data, total] = await Promise.all([
    ImportBatch.find({}).populate('createdBy', 'name role').sort({ createdAt: -1 }).limit(30).select('-rows'),
    ImportBatch.countDocuments(),
  ]);
  res.json({ success: true, total, data });
});

// Reorder levels (bulk-capable)
export const updateReorder = asyncH(async (req, res) => {
  const updates = Array.isArray(req.body) ? req.body : [req.body];
  const results = [];
  for (const u of updates) {
    const d = await InventoryStock.findByIdAndUpdate(u.id, { reorderLevel: u.reorderLevel, reorderQuantity: u.reorderQuantity }, { new: true });
    if (d) {
      const { available, reorderLevel } = d;
      d.status = available <= 0 ? 'OUT_OF_STOCK' : available <= (reorderLevel || 0) ? 'LOW_STOCK' : 'IN_STOCK';
      await d.save();
      results.push(d);
    }
  }
  res.json({ success: true, data: results });
});

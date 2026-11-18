import InventoryStock from '../../models/InventoryStock.js';
import Product from '../../models/Product.js';
import InventoryAlert from '../../models/InventoryAlert.js';
import { logInventoryAction } from './inventoryAuditService.js';

// Nightly integrity check — READ-ONLY except raising alerts + audit-loggging the run.
// Catches: negative buckets, broken available-math, website cache (Product.stock)
// drifting from the warehouse sum. Never auto-fixes: a human decides.
const DAY = 86400000;

const raiseOnce = async (type, { product, sku, warehouse, message }) => {
  const recent = await InventoryAlert.findOne({
    type, sku: sku || '', status: 'ACTIVE', createdAt: { $gte: new Date(Date.now() - DAY) },
  });
  if (recent) return { alerted: false, message };
  await InventoryAlert.create({ type, product: product || null, sku: sku || '', warehouse: warehouse || null, message });
  return { alerted: true, message };
};

export const reconcileInventory = async ({ actor = null } = {}) => {
  const issues = [];
  const stocks = await InventoryStock.find({}).lean();

  for (const s of stocks) {
    const buckets = ['onHand', 'reserved', 'incoming', 'damaged', 'lost', 'expired'];
    const negs = buckets.filter((k) => (s[k] || 0) < 0);
    if (negs.length) {
      issues.push({
        kind: 'NEGATIVE', sku: s.sku,
        ...(await raiseOnce('UNUSUAL_STOCK_MOVEMENT', {
          product: s.product, sku: s.sku, warehouse: s.warehouse,
          message: `Reconcile: negative buckets [${negs.join(', ')}] on ${s.sku || s._id}`,
        })),
      });
    }
    // Must mirror recompute(): available = max(0, onHand − reserved − damaged − lost − expired)
    const expect = Math.max(0, (s.onHand || 0) - (s.reserved || 0) - (s.damaged || 0) - (s.lost || 0) - (s.expired || 0));
    if ((s.available || 0) !== expect) {
      issues.push({
        kind: 'MATH', sku: s.sku,
        ...(await raiseOnce('UNUSUAL_STOCK_MOVEMENT', {
          product: s.product, sku: s.sku, warehouse: s.warehouse,
          message: `Reconcile: available=${s.available} but math says ${expect} (${s.sku || s._id})`,
        })),
      });
    }
  }

  // Website cache check: Product.stock must equal Σ available (see syncProductStock).
  const sums = await InventoryStock.aggregate([
    { $group: { _id: '$product', available: { $sum: '$available' } } },
  ]);
  for (const g of sums) {
    if (!g._id) continue;
    const p = await Product.findById(g._id).select('stock sku name').lean();
    if (!p) continue;
    const expect = Math.max(0, g.available || 0);
    if ((p.stock || 0) !== expect) {
      issues.push({
        kind: 'MISMATCH', sku: p.sku,
        ...(await raiseOnce('LARGE_STOCK_CHANGE', {
          product: p._id, sku: p.sku, warehouse: null,
          message: `Reconcile: website stock=${p.stock} but warehouse sum=${expect} (${p.sku})`,
        })),
      });
    }
  }

  await logInventoryAction({
    action: 'INVENTORY_RECONCILED', actor, performedByType: 'SYSTEM',
    entityType: 'InventoryStock', entityId: '',
    newValue: { checked: stocks.length, issues: issues.length },
    reason: 'Nightly/manual integrity check (read-only)',
  });
  return { checked: stocks.length, issues };
};

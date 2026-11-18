import StockMovement from '../models/StockMovement.js';
import InventoryStock from '../models/InventoryStock.js';
// Populate refs must resolve in any import order (cron, tests, isolated jobs).
import '../models/Product.js';
import '../models/Warehouse.js';

// Demand forecast: sale velocity (SALE movements) → days of cover → suggestion.
// Read-only analytics. No auto-ordering: humans decide, system advises.
//   velocity/day = sold ÷ days | daysLeft = available ÷ velocity
//   ORDER_NOW when daysLeft ≤ leadTime | SOON when ≤ 2× leadTime
//   suggestedQty = ceil(velocity × leadTime) − available (never negative)
// Zero-sale items: no velocity → suggestion falls back to reorderQuantity
// only when already low/out (slow movers shouldn't auto-inflate orders).
export const forecastDemand = async ({ days = 30, leadTimeDays = 7, limit = 50 } = {}) => {
  const daysN = Math.min(Math.max(Number(days) || 30, 7), 90);
  const lead = Math.min(Math.max(Number(leadTimeDays) || 7, 1), 30);
  const since = new Date(Date.now() - daysN * 86400000);

  const sales = await StockMovement.aggregate([
    { $match: { type: 'SALE', createdAt: { $gte: since } } },
    { $group: { _id: '$product', sold: { $sum: { $abs: '$quantity' } } } },
  ]);
  const soldByProduct = new Map(sales.map((s) => [String(s._id), s.sold]));

  const stocks = await InventoryStock.find({})
    .populate('product', 'name sku reorderLevel category')
    .populate('warehouse', 'name code')
    .lean();

  // Per-category buyer lead time (null = global default).
  const catIds = [...new Set(stocks.map((s) => String(s.product?.category?._id || s.product?.category || '')).filter(Boolean))];
  const leadByCat = new Map();
  if (catIds.length) {
    const { default: Category } = await import('../models/Category.js');
    const cats = await Category.find({ _id: { $in: catIds } }).select('leadTimeDays').lean();
    for (const c of cats) if (c.leadTimeDays) leadByCat.set(String(c._id), c.leadTimeDays);
  }
  const leadFor = (product) => leadByCat.get(String(product?.category?._id || product?.category || '')) || lead;

  // Aggregate per product across warehouses (buying decision is per product).
  const byProduct = new Map();
  for (const s of stocks) {
    const pid = String(s.product?._id || s.product);
    if (!byProduct.has(pid)) {
      byProduct.set(pid, {
        product: s.product, available: 0,
        warehouses: [],
      });
    }
    const g = byProduct.get(pid);
    g.available += s.available || 0;
    g.warehouses.push({ code: s.warehouse?.code || '', available: s.available || 0 });
  }

  const rows = [];
  for (const [, g] of byProduct) {
    const sold = soldByProduct.get(String(g.product?._id || '')) || 0;
    const velocity = sold / daysN;
    const llead = leadFor(g.product);
    const daysLeft = velocity > 0 ? g.available / velocity : null;
    const status = g.available <= 0 ? 'OUT' : daysLeft !== null && daysLeft <= llead ? 'ORDER_NOW' : daysLeft !== null && daysLeft <= llead * 2 ? 'SOON' : 'OK';
    let suggestedQty = 0;
    if (status === 'ORDER_NOW' || status === 'OUT') {
      suggestedQty = velocity > 0
        ? Math.max(0, Math.ceil(velocity * llead) - g.available)
        : Math.max(0, (g.product?.reorderLevel ?? 10) - g.available);
    }
    rows.push({
      product: g.product ? { _id: g.product._id, name: g.product.name, sku: g.product.sku } : null,
      sold, velocity: Math.round(velocity * 100) / 100,
      available: g.available,
      daysLeft: daysLeft === null ? null : Math.round(daysLeft * 10) / 10,
      status, suggestedQty, leadTimeDays: llead,
      warehouses: g.warehouses,
    });
  }
  rows.sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
  return { days: daysN, leadTimeDays: lead, generatedAt: new Date().toISOString(), rows: rows.slice(0, Math.min(Math.max(Number(limit) || 50, 1), 200)) };
};

// Dead stock: stocked but zero SALE in `days` (default 60). Locked cash =
// available × average cost (cost basis, never selling price). Suggests
// clearance (discount/campaign), never auto-discounts.
export const deadStockReport = async ({ days = 60, limit = 50 } = {}) => {
  const daysN = Math.min(Math.max(Number(days) || 60, 30), 365);
  const since = new Date(Date.now() - daysN * 86400000);

  const soldIds = await StockMovement.distinct('product', { type: 'SALE', createdAt: { $gte: since } });
  const soldSet = new Set(soldIds.map(String));

  const stocks = await InventoryStock.find({ available: { $gt: 0 } })
    .populate('product', 'name sku regularPrice')
    .populate('warehouse', 'name code')
    .lean();

  const byProduct = new Map();
  for (const s of stocks) {
    const pid = String(s.product?._id || s.product || '');
    if (!pid || soldSet.has(pid)) continue;
    if (!byProduct.has(pid)) {
      byProduct.set(pid, { product: s.product, available: 0, lockedValue: 0, warehouses: [] });
    }
    const g = byProduct.get(pid);
    g.available += s.available || 0;
    g.lockedValue += (s.available || 0) * (s.averageCost || 0);
    g.warehouses.push({ code: s.warehouse?.code || '', available: s.available || 0 });
  }

  // Last-ever sale date (outside the window) for context.
  const lastSales = await StockMovement.aggregate([
    { $match: { type: 'SALE' } },
    { $group: { _id: '$product', lastSaleAt: { $max: '$createdAt' } } },
  ]);
  const lastByProduct = new Map(lastSales.map((l) => [String(l._id), l.lastSaleAt]));

  const rows = [...byProduct.values()].map((g) => {
    const last = lastByProduct.get(String(g.product?._id || '')) || null;
    const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
    const suggested = !days ? 0 : days < 30 ? 0 : days < 60 ? 5 : days < 90 ? 10 : days < 120 ? 10 : days < 180 ? 15 : days < 365 ? 20 : 25;
    return {
      product: g.product ? { _id: g.product._id, name: g.product.name, sku: g.product.sku, regularPrice: g.product.regularPrice } : null,
      available: g.available,
      lockedValue: Math.round(g.lockedValue),
      lastSaleAt: last,
      daysSinceSale: days,
      suggestedMarkdownPct: suggested,
      warehouses: g.warehouses,
    };
  });
  rows.sort((a, b) => b.lockedValue - a.lockedValue);
  const totalLocked = rows.reduce((s, r) => s + r.lockedValue, 0);
  return { days: daysN, generatedAt: new Date().toISOString(), totalLocked, rows: rows.slice(0, Math.min(Math.max(Number(limit) || 50, 1), 200)) };
};

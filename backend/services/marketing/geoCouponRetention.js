import Order from '../../models/Order.js';
import Cart from '../../models/Cart.js';
import Coupon from '../../models/Coupon.js';
import { VALID_REVENUE_STATUS } from './salesAnalytics.js';

export const geoPerformance = async () => {
  const rows = await Order.aggregate([
    { $match: { orderStatus: { $in: VALID_REVENUE_STATUS } } },
    {
      $group: {
        _id: { city: '$shippingAddress.city', area: '$shippingAddress.area' },
        orders: { $sum: 1 },
        revenue: { $sum: '$totalAmount' },
        customers: { $addToSet: '$customer' },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 50 },
  ]);
  return rows.map((r) => ({
    city: r._id.city || 'Unknown',
    area: r._id.area || '',
    orders: r.orders,
    revenue: r.revenue,
    customers: r.customers.length,
    aov: r.orders ? Number((r.revenue / r.orders).toFixed(2)) : 0,
  }));
};

export const couponPerformance = async () => {
  const rows = await Order.aggregate([
    { $match: { orderStatus: { $in: VALID_REVENUE_STATUS }, couponCode: { $ne: null } } },
    {
      $group: {
        _id: '$couponCode',
        orders: { $sum: 1 },
        revenue: { $sum: '$totalAmount' },
        discount: { $sum: '$discount' },
      },
    },
    { $sort: { revenue: -1 } },
  ]);
  const coupons = await Coupon.find({}).select('code discountType discountValue usedCount isActive').lean();
  const map = new Map(coupons.map((c) => [c.code, c]));
  return rows.map((r) => {
    const c = map.get(r._id) || {};
    const roi = r.discount ? Number((r.revenue / r.discount).toFixed(1)) : 0;
    return { code: r._id, orders: r.orders, revenue: r.revenue, discountGiven: r.discount, revenuePerTakaDiscount: roi, active: c.isActive, usedCount: c.usedCount || 0 };
  });
};

// Repeat purchase + monthly cohorts (first-purchase month → M+1..M+3 retention)
export const retentionCohorts = async () => {
  const orders = await Order.find({ orderStatus: { $in: VALID_REVENUE_STATUS } }).select('customer createdAt').lean();
  const first = new Map();
  for (const o of orders) {
    const id = String(o.customer);
    const t = new Date(o.createdAt).getTime();
    if (!first.has(id) || t < first.get(id)) first.set(id, t);
  }
  const cohorts = {};
  for (const o of orders) {
    const id = String(o.customer);
    const f = new Date(first.get(id));
    const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
    const ageM = (new Date(o.createdAt).getFullYear() - f.getFullYear()) * 12 + (new Date(o.createdAt).getMonth() - f.getMonth());
    cohorts[key] = cohorts[key] || { cohort: key, size: new Set(), m1: new Set(), m2: new Set(), m3: new Set() };
    cohorts[key].size.add(id);
    if (ageM === 1) cohorts[key].m1.add(id);
    else if (ageM === 2) cohorts[key].m2.add(id);
    else if (ageM === 3) cohorts[key].m3.add(id);
  }
  const repeatBuyers = [...first.keys()].filter((id) => orders.filter((o) => String(o.customer) === id).length > 1).length;
  return {
    repeatRate: first.size ? Number(((repeatBuyers / first.size) * 100).toFixed(1)) : 0,
    cohorts: Object.values(cohorts)
      .sort((a, b) => (a.cohort < b.cohort ? 1 : -1))
      .slice(0, 6)
      .map((c) => ({ cohort: c.cohort, size: c.size.size, m1: pct(c.m1.size, c.size.size), m2: pct(c.m2.size, c.size.size), m3: pct(c.m3.size, c.size.size) })),
  };
};
const pct = (a, b) => (b ? Number(((a / b) * 100).toFixed(1)) : 0);

// Growth levers: abandoned carts (items + stale) — manual re-engagement list
export const abandonedCarts = async ({ days = 1, limit = 50 } = {}) => {
  const cutoff = new Date(Date.now() - Number(days) * 86400000);
  const rows = await Cart.find({ updatedAt: { $lte: cutoff } })
    .populate('user', 'name phone email')
    .populate('items.product', 'name salePrice regularPrice')
    .sort({ updatedAt: -1 })
    .limit(Number(limit))
    .lean();
  return rows
    .filter((c) => (c.items || []).length > 0)
    .map((c) => ({
      customer: c.user?.name || '',
      phone: c.user?.phone || '',
      items: (c.items || []).length,
      value: Math.round((c.items || []).reduce((s, i) => s + (i.product?.salePrice || i.product?.regularPrice || 0) * (i.quantity || 0), 0)),
      lastActive: c.updatedAt,
    }));
};

// Data-quality gate — never silently trust bad data
export const qualityReport = async () => {
  const [total, cancelled, noItems, negative, noCustomer, dupNumbers] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({ orderStatus: { $in: ['Cancelled', 'CANCELLED'] } }),
    Order.countDocuments({ $or: [{ orderItems: { $size: 0 } }, { orderItems: { $exists: false } }] }),
    Order.countDocuments({ totalAmount: { $lt: 0 } }),
    Order.countDocuments({ customer: null }),
    Order.aggregate([{ $group: { _id: '$orderNumber', n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: 'dups' }]),
  ]);
  return {
    totalOrders: total,
    checks: [
      { check: 'Cancelled orders excluded from revenue', status: 'ENFORCED', detail: `${cancelled} cancelled kept out` },
      { check: 'Orders without items', status: noItems ? 'WARNING' : 'OK', detail: String(noItems) },
      { check: 'Negative totals', status: negative ? 'WARNING' : 'OK', detail: String(negative) },
      { check: 'Missing customer ref', status: noCustomer ? 'WARNING' : 'OK', detail: String(noCustomer) },
      { check: 'Duplicate order numbers', status: (dupNumbers[0]?.dups || 0) ? 'WARNING' : 'OK', detail: String(dupNumbers[0]?.dups || 0) },
      { check: 'UTM/campaign attribution', status: 'DATA_UNAVAILABLE', detail: 'No source fields in orders yet — see gap analysis' },
      { check: 'Meta Ads spend/clicks', status: 'DATA_UNAVAILABLE', detail: 'Not connected — CAC/ROAS cannot be computed yet' },
    ],
  };
};

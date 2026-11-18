import Order from '../../models/Order.js';

// Only fulfilled-revenue counts: cancelled/failed excluded (never silently).
export const VALID_REVENUE_STATUS = ['Pending', 'Confirmed', 'Processing', 'Ready for Delivery', 'Out for Delivery', 'Delivered', 'PLACED', 'PENDING_VERIFICATION', 'CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export const salesOverview = async ({ from, to } = {}) => {
  const match = { orderStatus: { $in: VALID_REVENUE_STATUS } };
  if (from || to) match.createdAt = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
  const [agg] = await Order.aggregate([
    { $match: match },
    { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 }, customers: { $addToSet: '$customer' } } },
  ]);
  const revenue = agg?.revenue || 0;
  const orders = agg?.orders || 0;
  return { revenue, orders, customers: agg?.customers?.length || 0, aov: orders ? Number((revenue / orders).toFixed(2)) : 0 };
};

export const salesSeries = async ({ from, to, grain = 'day' } = {}) => {
  const match = { orderStatus: { $in: VALID_REVENUE_STATUS } };
  if (from || to) match.createdAt = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
  else match.createdAt = { $gte: new Date(Date.now() - 30 * 86400000) };
  const fmt = grain === 'month' ? '%Y-%m' : grain === 'week' ? '%Y-W%V' : '%Y-%m-%d';
  const rows = await Order.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: fmt, date: '$createdAt' } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  // Growth: last period vs previous equal-length period
  const half = Math.ceil(rows.length / 2);
  const sum = (rs) => rs.reduce((s, r) => s + r.revenue, 0);
  const prev = sum(rows.slice(0, half));
  const curr = sum(rows.slice(half));
  return { rows, growthPct: prev ? Number((((curr - prev) / prev) * 100).toFixed(1)) : 0 };
};

export const hourlyHeatmap = async () => {
  const rows = await Order.aggregate([
    { $match: { orderStatus: { $in: VALID_REVENUE_STATUS }, createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
    { $group: { _id: { $hour: '$createdAt' }, orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
    { $sort: { _id: 1 } },
  ]);
  return rows; // best hours → campaign timing
};

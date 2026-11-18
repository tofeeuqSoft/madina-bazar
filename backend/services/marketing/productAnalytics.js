import Order from '../../models/Order.js';
import Product from '../../models/Product.js';
import { VALID_REVENUE_STATUS } from './salesAnalytics.js';

export const productPerformance = async ({ limit = 20 } = {}) => {
  const rows = await Order.aggregate([
    { $match: { orderStatus: { $in: VALID_REVENUE_STATUS } } },
    { $unwind: '$orderItems' },
    {
      $group: {
        _id: { product: '$orderItems.product', name: '$orderItems.name' },
        qty: { $sum: '$orderItems.quantity' },
        revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } },
        orders: { $sum: 1 },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: Number(limit) * 2 },
  ]);
  const ids = rows.map((r) => r._id.product).filter(Boolean);
  const products = await Product.find({ _id: { $in: ids } }).select('name stock costPrice regularPrice category').populate('category', 'name').lean();
  const map = new Map(products.map((p) => [String(p._id), p]));
  return rows.map((r) => {
    const p = map.get(String(r._id.product)) || {};
    const margin = (r.revenue || 0) - (r.qty || 0) * (p.costPrice || 0);
    return { name: r._id.name || p.name, productId: r._id.product, qty: r.qty, revenue: r.revenue, orders: r.orders, margin: Math.round(margin), stock: p.stock, category: p.category?.name || '' };
  });
};

export const categoryPerformance = async () => {
  const top = await productPerformance({ limit: 500 });
  const byCat = {};
  for (const t of top) {
    const c = t.category || 'Uncategorized';
    byCat[c] = byCat[c] || { category: c, revenue: 0, qty: 0, products: 0 };
    byCat[c].revenue += t.revenue;
    byCat[c].qty += t.qty;
    byCat[c].products += 1;
  }
  return Object.values(byCat).sort((a, b) => b.revenue - a.revenue);
};

export const slowMovers = async ({ limit = 20 } = {}) => {
  const soldIds = await Order.distinct('orderItems.product', { orderStatus: { $in: VALID_REVENUE_STATUS } });
  const rows = await Product.find({ _id: { $nin: soldIds }, isActive: true })
    .select('name sku stock costPrice category')
    .populate('category', 'name')
    .sort({ stock: -1 })
    .limit(Number(limit))
    .lean();
  return rows.map((p) => ({ ...p, tiedCash: Math.round((p.stock || 0) * (p.costPrice || 0)) }));
};

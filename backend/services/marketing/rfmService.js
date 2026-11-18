import Order from '../../models/Order.js';
import User from '../../models/User.js';
import { VALID_REVENUE_STATUS } from './salesAnalytics.js';

// RFM segmentation — thresholds documented, quintile-scored 1..5.
// Segments: Champions / Loyal / New / Potential Loyalist / At Risk /
// Cannot Lose / Hibernating / Lost. Used for re-engagement campaigns.
const segmentOf = (r, f, m, isNew) => {
  if (isNew) return 'New Customers';
  const score = `${r}${f}${m}`;
  if (['555', '554', '544', '545', '454', '455', '445'].includes(score)) return 'Champions';
  if (f >= 4 && m >= 4) return 'Loyal Customers';
  if (r >= 4 && f <= 2) return 'Potential Loyalists';
  if (r <= 2 && f >= 4 && m >= 4) return 'Cannot Lose Them';
  if (r === 3 && f >= 3) return 'Need Attention';
  if (r <= 2 && f >= 2) return 'At Risk';
  if (r <= 2) return 'Hibernating';
  if (r === 1 && f === 1) return 'Lost Customers';
  return 'Others';
};

const quintile = (sortedAsc, value, highIsGood = true) => {
  if (!sortedAsc.length) return 3;
  const idx = sortedAsc.findIndex((v) => value <= v);
  const pos = idx === -1 ? sortedAsc.length : idx + 1;
  const q = Math.min(5, Math.ceil((pos / sortedAsc.length) * 5));
  return highIsGood ? q : 6 - q;
};

export const rfmSegments = async ({ limit = 2000 } = {}) => {
  const orders = await Order.find({ orderStatus: { $in: VALID_REVENUE_STATUS } })
    .select('customer totalAmount createdAt')
    .sort({ createdAt: -1 })
    .limit(20000)
    .lean();
  const byCust = new Map();
  const now = Date.now();
  for (const o of orders) {
    const id = String(o.customer);
    if (!byCust.has(id)) byCust.set(id, { last: o.createdAt, first: o.createdAt, count: 0, money: 0 });
    const c = byCust.get(id);
    c.count += 1;
    c.money += o.totalAmount || 0;
    if (o.createdAt > c.last) c.last = o.createdAt;
    if (o.createdAt < c.first) c.first = o.createdAt;
  }
  const rec = [...byCust.values()].map((c) => (now - new Date(c.last).getTime()) / 86400000).sort((a, b) => a - b);
  const freq = [...byCust.values()].map((c) => c.count).sort((a, b) => a - b);
  const mon = [...byCust.values()].map((c) => c.money).sort((a, b) => a - b);

  const ids = [...byCust.keys()].slice(0, Number(limit));
  const users = await User.find({ _id: { $in: ids } }).select('name email phone createdAt').lean();
  const umap = new Map(users.map((u) => [String(u._id), u]));

  const out = [];
  const counts = {};
  for (const id of ids) {
    const c = byCust.get(id);
    const rDays = (now - new Date(c.last).getTime()) / 86400000;
    const r = quintile(rec, rDays, false);
    const f = quintile(freq, c.count, true);
    const m = quintile(mon, c.money, true);
    const isNew = (now - new Date(c.first).getTime()) / 86400000 <= 30 && c.count <= 2;
    const segment = segmentOf(r, f, m, isNew);
    counts[segment] = (counts[segment] || 0) + 1;
    out.push({ customerId: id, name: umap.get(id)?.name || '', phone: umap.get(id)?.phone || '', recencyDays: Math.round(rDays), frequency: c.count, monetary: Math.round(c.money), r, f, m, segment });
  }
  out.sort((a, b) => b.monetary - a.monetary);
  return { segments: counts, customers: out.slice(0, 500), total: byCust.size };
};

export const newVsReturning = async () => {
  const orders = await Order.find({ orderStatus: { $in: VALID_REVENUE_STATUS } }).select('customer totalAmount').lean();
  const seen = new Set();
  let newRev = 0;
  let newOrd = 0;
  let retRev = 0;
  let retOrd = 0;
  // First-seen in this window approximates new vs returning
  const firstSeen = new Map();
  for (const o of orders) {
    const id = String(o.customer);
    if (!firstSeen.has(id)) {
      firstSeen.set(id, true);
      newRev += o.totalAmount || 0;
      newOrd += 1;
    } else {
      retRev += o.totalAmount || 0;
      retOrd += 1;
    }
    seen.add(id);
  }
  return { newCustomers: firstSeen.size, newOrders: newOrd, newRevenue: Math.round(newRev), returningOrders: retOrd, returningRevenue: Math.round(retRev) };
};

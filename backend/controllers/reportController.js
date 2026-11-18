import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Purchase from '../models/Purchase.js';
import Expense from '../models/Expense.js';
import Supplier from '../models/Supplier.js';
import Return from '../models/Return.js';

// ---------- helpers ----------
const parseDate = (v, fallback) => {
  if (!v) return fallback;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? fallback : d;
};

export const getRange = (req) => {
  const now = new Date();
  const dfltFrom = new Date(now);
  dfltFrom.setDate(dfltFrom.getDate() - 30);
  const from = parseDate(req.query.from, dfltFrom);
  const to = parseDate(req.query.to, now);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
};

const meta = (from, to, extra = {}) => ({
  from,
  to,
  currency: 'BDT (৳)',
  ...extra,
});

const dayFormat = (groupBy) => (groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d');

// Cost fallback: costPrice > 0 ? costPrice : regularPrice (flag estimated)
const costExpr = {
  $let: {
    vars: { p: { $arrayElemAt: ['$prod', 0] } },
    in: {
      $cond: [
        { $gt: ['$$p.costPrice', 0] },
        '$$p.costPrice',
        {
          $cond: [
            { $gt: ['$$p.regularPrice', 0] },
            '$$p.regularPrice',
            { $multiply: ['$item.price', 0.7] },
          ],
        },
      ],
    },
  },
};

// ---------- 1. SALES ----------
export const salesReport = async (req, res) => {
  try {
    const { from, to } = getRange(req);
    const { groupBy = 'day', page = 1, limit = 20 } = req.query;
    const match = {
      createdAt: { $gte: from, $lte: to },
      orderStatus: { $ne: 'Cancelled' },
    };

    const [totals] = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          subtotal: { $sum: '$subtotal' },
          discount: { $sum: '$discount' },
          delivery: { $sum: '$deliveryCharge' },
          revenue: { $sum: '$totalAmount' },
          items: { $sum: { $sum: '$orderItems.quantity' } },
        },
      },
    ]);

    const byDay = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: dayFormat(groupBy), date: '$createdAt' } },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          discount: { $sum: '$discount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const byPayment = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { method: '$paymentMethod', status: '$paymentStatus' },
          orders: { $sum: 1 },
          amount: { $sum: '$totalAmount' },
        },
      },
      { $sort: { amount: -1 } },
    ]);

    const byStatus = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: '$orderStatus', orders: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
    ]);

    const skip = (Number(page) - 1) * Number(limit);
    const [list, total] = await Promise.all([
      Order.find(match)
        .populate('customer', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('orderNumber customer orderItems subtotal discount deliveryCharge totalAmount paymentMethod paymentStatus orderStatus createdAt'),
      Order.countDocuments(match),
    ]);

    res.json({
      success: true,
      data: {
        totals: {
          orders: totals?.orders || 0,
          items: totals?.items || 0,
          subtotal: totals?.subtotal || 0,
          discount: totals?.discount || 0,
          delivery: totals?.delivery || 0,
          revenue: totals?.revenue || 0,
          avgOrder: totals?.orders ? +(totals.revenue / totals.orders).toFixed(2) : 0,
        },
        byDay, byPayment, byStatus, list,
      },
      meta: { ...meta(from, to), page: Number(page), pages: Math.ceil(total / Number(limit)), total },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------- 2. PURCHASE ----------
export const purchaseReport = async (req, res) => {
  try {
    const { from, to } = getRange(req);
    const { page = 1, limit = 20 } = req.query;
    const match = { purchaseDate: { $gte: from, $lte: to } };

    const [totals] = await Purchase.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          bills: { $sum: 1 },
          subtotal: { $sum: '$subtotal' },
          discount: { $sum: '$discount' },
          totalCost: { $sum: '$totalCost' },
          paid: { $sum: '$paidAmount' },
          due: { $sum: '$dueAmount' },
        },
      },
    ]);

    const bySupplier = await Purchase.aggregate([
      { $match: match },
      { $group: { _id: '$supplier', bills: { $sum: 1 }, cost: { $sum: '$totalCost' }, paid: { $sum: '$paidAmount' }, due: { $sum: '$dueAmount' } } },
      { $sort: { cost: -1 } },
      { $lookup: { from: 'suppliers', localField: '_id', foreignField: '_id', as: 's' } },
      { $unwind: { path: '$s', preserveNullAndEmptyArrays: true } },
      { $project: { supplier: '$s.name', company: '$s.company', bills: 1, cost: 1, paid: 1, due: 1 } },
    ]);

    const skip = (Number(page) - 1) * Number(limit);
    const [list, total] = await Promise.all([
      Purchase.find(match).populate('supplier', 'name company phone').sort({ purchaseDate: -1 }).skip(skip).limit(Number(limit)),
      Purchase.countDocuments(match),
    ]);

    res.json({
      success: true,
      data: {
        totals: { bills: totals?.bills || 0, subtotal: totals?.subtotal || 0, discount: totals?.discount || 0, totalCost: totals?.totalCost || 0, paid: totals?.paid || 0, due: totals?.due || 0 },
        bySupplier, list,
      },
      meta: { ...meta(from, to), page: Number(page), pages: Math.ceil(total / Number(limit)), total },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------- 3. EXPENSE ----------
export const expenseReport = async (req, res) => {
  try {
    const { from, to } = getRange(req);
    const { page = 1, limit = 20 } = req.query;
    const match = { expenseDate: { $gte: from, $lte: to } };

    const [totals] = await Expense.aggregate([
      { $match: match },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]);
    const byCategory = await Expense.aggregate([
      { $match: match },
      { $group: { _id: '$category', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      { $sort: { amount: -1 } },
    ]);
    const byMethod = await Expense.aggregate([
      { $match: match },
      { $group: { _id: '$paymentMethod', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]);

    const skip = (Number(page) - 1) * Number(limit);
    const [list, total] = await Promise.all([
      Expense.find(match).sort({ expenseDate: -1 }).skip(skip).limit(Number(limit)),
      Expense.countDocuments(match),
    ]);

    res.json({
      success: true,
      data: { totals: { count: totals?.count || 0, amount: totals?.amount || 0 }, byCategory, byMethod, list },
      meta: { ...meta(from, to), page: Number(page), pages: Math.ceil(total / Number(limit)), total },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------- shared COGS aggregation ----------
const cogsPipeline = (from, to) => [
  { $match: { createdAt: { $gte: from, $lte: to }, orderStatus: { $ne: 'Cancelled' } } },
  { $unwind: '$orderItems' },
  {
    $lookup: {
      from: 'products',
      localField: 'orderItems.product',
      foreignField: '_id',
      as: 'prod',
    },
  },
  {
    $addFields: {
      'item.qty': '$orderItems.quantity',
      'item.revenue': { $multiply: ['$orderItems.price', '$orderItems.quantity'] },
      'item.cost': { $multiply: [costExpr, '$orderItems.quantity'] },
      'item.name': '$orderItems.name',
    },
  },
];

async function calcCogs(from, to) {
  const [r] = await Order.aggregate([
    ...cogsPipeline(from, to),
    { $group: { _id: null, revenue: { $sum: '$item.revenue' }, cogs: { $sum: '$item.cost' }, qty: { $sum: '$item.qty' } } },
  ]);
  return { revenue: r?.revenue || 0, cogs: r?.cogs || 0, qty: r?.qty || 0 };
}

// ---------- 14. COGS ----------
export const cogsReport = async (req, res) => {
  try {
    const { from, to } = getRange(req);
    const overall = await calcCogs(from, to);
    const byProduct = await Order.aggregate([
      ...cogsPipeline(from, to),
      { $group: { _id: '$item.name', qty: { $sum: '$item.qty' }, revenue: { $sum: '$item.revenue' }, cogs: { $sum: '$item.cost' } } },
      { $addFields: { gross: { $subtract: ['$revenue', '$cogs'] } } },
      { $sort: { cogs: -1 } },
      { $limit: 50 },
    ]);
    const byDay = await Order.aggregate([
      ...cogsPipeline(from, to),
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$item.revenue' },
          cogs: { $sum: '$item.cost' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json({
      success: true,
      data: { totals: overall, gross: overall.revenue - overall.cogs, byProduct, byDay, note: 'Unit cost = product.costPrice, fallback regularPrice, then 70% of sale price (estimated).' },
      meta: meta(from, to),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------- 15. GROSS PROFIT ----------
export const grossProfitReport = async (req, res) => {
  try {
    const { from, to } = getRange(req);
    const overall = await calcCogs(from, to);
    const [disc] = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: null, discount: { $sum: '$discount' }, delivery: { $sum: '$deliveryCharge' } } },
    ]);
    const byDay = await Order.aggregate([
      ...cogsPipeline(from, to),
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$item.revenue' },
          cogs: { $sum: '$item.cost' },
        },
      },
      { $addFields: { gross: { $subtract: ['$revenue', '$cogs'] } } },
      { $sort: { _id: 1 } },
    ]);
    const gross = overall.revenue - overall.cogs;
    res.json({
      success: true,
      data: {
        totals: {
          revenue: overall.revenue, cogs: overall.cogs, gross,
          margin: overall.revenue ? +((gross / overall.revenue) * 100).toFixed(2) : 0,
          discount: disc?.discount || 0, deliveryIncome: disc?.delivery || 0,
          grossAfterDiscount: gross - (disc?.discount || 0),
        },
        byDay,
      },
      meta: meta(from, to),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------- 16 + 4. NET PROFIT & P&L ----------
export const profitLossReport = async (req, res) => {
  try {
    const { from, to } = getRange(req);
    const overall = await calcCogs(from, to);
    const [ord] = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: null, orders: { $sum: 1 }, subtotal: { $sum: '$subtotal' }, discount: { $sum: '$discount' }, delivery: { $sum: '$deliveryCharge' }, revenue: { $sum: '$totalAmount' } } },
    ]);
    const [exp] = await Expense.aggregate([
      { $match: { expenseDate: { $gte: from, $lte: to } } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]);
    const [ret] = await Return.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: { $in: ['Approved', 'Refunded'] } } },
      { $group: { _id: null, amount: { $sum: '$refundAmount' } } },
    ]);
    const revenue = ord?.revenue || 0;
    const cogs = overall.cogs;
    const gross = revenue - cogs;
    const expenses = exp?.amount || 0;
    const refunds = ret?.amount || 0;
    const net = gross - expenses - refunds;

    const expByCat = await Expense.aggregate([
      { $match: { expenseDate: { $gte: from, $lte: to } } },
      { $group: { _id: '$category', amount: { $sum: '$amount' } } },
      { $sort: { amount: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        income: { orders: ord?.orders || 0, subtotal: ord?.subtotal || 0, discount: ord?.discount || 0, deliveryIncome: ord?.delivery || 0, revenue },
        cost: { cogs, expenses, refunds, expenseBreakdown: expByCat },
        result: {
          gross, grossMargin: revenue ? +((gross / revenue) * 100).toFixed(2) : 0,
          net, netMargin: revenue ? +((net / revenue) * 100).toFixed(2) : 0,
        },
      },
      meta: meta(from, to),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const netProfitReport = async (req, res) => {
  // Same engine, slimmer shape for the dedicated tab
  req.query._slim = '1';
  return profitLossReport(req, res);
};

// ---------- 13. INVENTORY VALUATION ----------
export const inventoryValuationReport = async (req, res) => {
  try {
    const products = await Product.find({}).select('name sku stock regularPrice costPrice category').populate('category', 'name').lean();
    let totalQty = 0, totalCost = 0, totalRetail = 0, estimated = 0;
    const list = products.map((p) => {
      const unitCost = p.costPrice > 0 ? p.costPrice : p.regularPrice || 0;
      const isEstimated = !(p.costPrice > 0);
      if (isEstimated) estimated += 1;
      const costVal = (p.stock || 0) * unitCost;
      const retailVal = (p.stock || 0) * (p.regularPrice || 0);
      totalQty += p.stock || 0;
      totalCost += costVal;
      totalRetail += retailVal;
      return {
        _id: p._id, name: p.name, sku: p.sku, category: p.category?.name || '',
        stock: p.stock, unitCost, salePrice: p.regularPrice, estimated: isEstimated,
        costValue: +costVal.toFixed(2), retailValue: +retailVal.toFixed(2),
      };
    }).sort((a, b) => b.costValue - a.costValue);

    res.json({
      success: true,
      data: {
        totals: {
          skus: products.length, units: totalQty,
          costValue: +totalCost.toFixed(2), retailValue: +totalRetail.toFixed(2),
          potentialMargin: +(totalRetail - totalCost).toFixed(2), estimatedCount: estimated,
        },
        list: req.query.limit === 'all' ? list : list.slice(0, Number(req.query.limit) || 100),
      },
      meta: meta(new Date(0), new Date(), { note: 'Estimated = costPrice missing, used regularPrice as cost.' }),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------- 7. CUSTOMER DUE ----------
export const customerDueReport = async (req, res) => {
  try {
    const rows = await Order.aggregate([
      { $match: { paymentStatus: { $in: ['Pending', 'Failed'] }, orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: '$customer', orders: { $sum: 1 }, due: { $sum: '$totalAmount' }, orderIds: { $push: { orderNumber: '$orderNumber', total: '$totalAmount', method: '$paymentMethod', status: '$orderStatus', date: '$createdAt' } } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
      { $project: { customer: '$u.name', phone: '$u.phone', email: '$u.email', orders: 1, due: 1, orderIds: { $slice: ['$orderIds', 20] } } },
      { $sort: { due: -1 } },
      { $limit: 200 },
    ]);
    const totalDue = rows.reduce((s, r) => s + r.due, 0);
    res.json({ success: true, data: { totals: { customers: rows.length, due: +totalDue.toFixed(2) }, list: rows }, meta: meta(new Date(0), new Date()) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------- 8. SUPPLIER DUE ----------
export const supplierDueReport = async (req, res) => {
  try {
    const rows = await Purchase.aggregate([
      { $match: { dueAmount: { $gt: 0 } } },
      { $group: { _id: '$supplier', bills: { $sum: 1 }, total: { $sum: '$totalCost' }, paid: { $sum: '$paidAmount' }, due: { $sum: '$dueAmount' } } },
      { $lookup: { from: 'suppliers', localField: '_id', foreignField: '_id', as: 's' } },
      { $unwind: { path: '$s', preserveNullAndEmptyArrays: true } },
      { $project: { supplier: '$s.name', company: '$s.company', phone: '$s.phone', bills: 1, total: 1, paid: 1, due: 1 } },
      { $sort: { due: -1 } },
    ]);
    // Include supplier opening dues with no purchases yet
    const noTxn = await Supplier.find({ isActive: true, openingDue: { $gt: 0 } }).select('name company phone openingDue').lean();
    const totalDue = rows.reduce((s, r) => s + r.due, 0) + noTxn.reduce((s, x) => s + (x.openingDue || 0), 0);
    res.json({ success: true, data: { totals: { suppliers: rows.length, due: +totalDue.toFixed(2) }, list: rows, openingDues: noTxn }, meta: meta(new Date(0), new Date()) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------- 9. PAYMENT ----------
export const paymentReport = async (req, res) => {
  try {
    const { from, to } = getRange(req);
    const match = { createdAt: { $gte: from, $lte: to }, orderStatus: { $ne: 'Cancelled' } };
    const byMethod = await Order.aggregate([
      { $match: match },
      { $group: { _id: '$paymentMethod', orders: { $sum: 1 }, amount: { $sum: '$totalAmount' }, paid: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, '$totalAmount', 0] } } } },
      { $sort: { amount: -1 } },
    ]);
    const byStatus = await Order.aggregate([
      { $match: match },
      { $group: { _id: '$paymentStatus', orders: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
    ]);
    const matrix = await Order.aggregate([
      { $match: match },
      { $group: { _id: { m: '$paymentMethod', s: '$paymentStatus' }, orders: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
      { $sort: { amount: -1 } },
    ]);
    const [totals] = await Order.aggregate([
      { $match: match },
      { $group: { _id: null, orders: { $sum: 1 }, amount: { $sum: '$totalAmount' }, collected: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, '$totalAmount', 0] } } } },
    ]);
    res.json({
      success: true,
      data: {
        totals: { orders: totals?.orders || 0, amount: totals?.amount || 0, collected: totals?.collected || 0, pending: (totals?.amount || 0) - (totals?.collected || 0) },
        byMethod, byStatus, matrix,
      },
      meta: meta(from, to),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------- 10. REFUND ----------
export const refundReport = async (req, res) => {
  try {
    const { from, to } = getRange(req);
    const list = await Return.find({ createdAt: { $gte: from, $lte: to } })
      .populate('order', 'orderNumber totalAmount')
      .sort({ createdAt: -1 })
      .limit(100);
    const [agg] = await Return.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$refundAmount' }, refunded: { $sum: { $cond: [{ $eq: ['$status', 'Refunded'] }, '$refundAmount', 0] } } } },
    ]);
    const gatewayRefunds = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, paymentStatus: 'Refunded' } },
      { $group: { _id: '$paymentMethod', orders: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
    ]);
    res.json({
      success: true,
      data: {
        totals: { count: agg?.count || 0, claimed: agg?.amount || 0, refunded: agg?.refunded || 0, gatewayRefundedOrders: gatewayRefunds },
        list,
      },
      meta: meta(from, to),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------- 11. RETURN ----------
export const returnReport = async (req, res) => {
  try {
    const { from, to } = getRange(req);
    const match = { createdAt: { $gte: from, $lte: to } };
    const [totals] = await Return.aggregate([
      { $match: match },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$refundAmount' } } },
    ]);
    const byType = await Return.aggregate([
      { $match: match },
      { $group: { _id: '$type', count: { $sum: 1 }, amount: { $sum: '$refundAmount' } } },
    ]);
    const byStatus = await Return.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$refundAmount' } } },
    ]);
    const list = await Return.find(match).populate('order', 'orderNumber').sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: { totals: { count: totals?.count || 0, amount: totals?.amount || 0 }, byType, byStatus, list }, meta: meta(from, to) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------- 12. TAX ----------
export const taxReport = async (req, res) => {
  try {
    const { from, to } = getRange(req);
    const taxRate = Math.max(0, Number(req.query.taxRate ?? 0)); // % — configurable, default 0 (grocery often VAT-exempt)
    const [t] = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: null, orders: { $sum: 1 }, subtotal: { $sum: '$subtotal' }, discount: { $sum: '$discount' }, delivery: { $sum: '$deliveryCharge' }, revenue: { $sum: '$totalAmount' } } },
    ]);
    const taxable = (t?.subtotal || 0) - (t?.discount || 0);
    const tax = +(taxable * (taxRate / 100)).toFixed(2);
    const byDay = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, orderStatus: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          taxable: { $sum: { $subtract: ['$subtotal', '$discount'] } },
        },
      },
      { $addFields: { tax: { $multiply: ['$taxable', taxRate / 100] } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({
      success: true,
      data: {
        totals: { orders: t?.orders || 0, taxable: +taxable.toFixed(2), taxRate, tax, delivery: t?.delivery || 0, revenue: t?.revenue || 0 },
        byDay,
      },
      meta: meta(from, to, { note: 'Tax = (subtotal − discount) × rate. Pass ?taxRate=5 etc. Default 0.' }),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------- 5. BALANCE SHEET ----------
export const balanceSheetReport = async (req, res) => {
  try {
    const asOf = parseDate(req.query.asOf, new Date());
    const [paid] = await Order.aggregate([
      { $match: { createdAt: { $lte: asOf }, paymentStatus: 'Paid', orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: null, amount: { $sum: '$totalAmount' } } },
    ]);
    const [due] = await Order.aggregate([
      { $match: { createdAt: { $lte: asOf }, paymentStatus: { $in: ['Pending', 'Failed'] }, orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: null, amount: { $sum: '$totalAmount' } } },
    ]);
    const [pur] = await Purchase.aggregate([
      { $match: { purchaseDate: { $lte: asOf } } },
      { $group: { _id: null, cost: { $sum: '$totalCost' }, paid: { $sum: '$paidAmount' }, due: { $sum: '$dueAmount' } } },
    ]);
    const [exp] = await Expense.aggregate([
      { $match: { expenseDate: { $lte: asOf } } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]);
    const [ref] = await Return.aggregate([
      { $match: { createdAt: { $lte: asOf }, status: { $in: ['Approved', 'Refunded'] } } },
      { $group: { _id: null, amount: { $sum: '$refundAmount' } } },
    ]);
    const inv = await Product.aggregate([
      {
        $project: {
          costVal: {
            $multiply: ['$stock', { $cond: [{ $gt: ['$costPrice', 0] }, '$costPrice', { $ifNull: ['$regularPrice', 0] }] }],
          },
        },
      },
      { $group: { _id: null, value: { $sum: '$costVal' } } },
    ]);

    const inventory = inv[0]?.value || 0;
    const receivables = due?.amount || 0;
    const cash = (paid?.amount || 0) - (pur?.paid || 0) - (exp?.amount || 0) - (ref?.amount || 0);
    const assets = inventory + receivables + Math.max(0, cash);
    const supplierDue = pur?.due || 0;
    const liabilities = supplierDue;
    const equity = assets - liabilities;

    res.json({
      success: true,
      data: {
        asOf,
        assets: { inventory: +inventory.toFixed(2), receivables: +receivables.toFixed(2), cash: +cash.toFixed(2), total: +assets.toFixed(2) },
        liabilities: { supplierDue: +supplierDue.toFixed(2), total: +liabilities.toFixed(2) },
        equity: +equity.toFixed(2),
        check: +((assets - liabilities - equity).toFixed(2)),
      },
      meta: meta(new Date(0), asOf, { note: 'Simplified e-commerce balance sheet. Cash = lifetime paid sales − purchases paid − expenses − approved refunds.' }),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------- 6. CASH FLOW ----------
export const cashFlowReport = async (req, res) => {
  try {
    const { from, to } = getRange(req);
    const [inflow] = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, paymentStatus: 'Paid', orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: null, amount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);
    const [purPaid] = await Purchase.aggregate([
      { $match: { purchaseDate: { $gte: from, $lte: to } } },
      { $group: { _id: null, amount: { $sum: '$paidAmount' } } },
    ]);
    const [exp] = await Expense.aggregate([
      { $match: { expenseDate: { $gte: from, $lte: to } } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]);
    const [ref] = await Return.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'Refunded' } },
      { $group: { _id: null, amount: { $sum: '$refundAmount' } } },
    ]);
    const inflowByDay = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, paymentStatus: 'Paid', orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, inflow: { $sum: '$totalAmount' } } },
      { $sort: { _id: 1 } },
    ]);
    const outflowByDay = await Expense.aggregate([
      { $match: { expenseDate: { $gte: from, $lte: to } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$expenseDate' } }, outflow: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]);

    const inAmt = inflow?.amount || 0;
    const outAmt = (purPaid?.amount || 0) + (exp?.amount || 0) + (ref?.amount || 0);
    res.json({
      success: true,
      data: {
        totals: {
          inflow: inAmt, inflowCount: inflow?.count || 0,
          purchaseOut: purPaid?.amount || 0, expenseOut: exp?.amount || 0, refundOut: ref?.amount || 0,
          outflow: outAmt, net: +(inAmt - outAmt).toFixed(2),
        },
        inflowByDay, outflowByDay,
      },
      meta: meta(from, to),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------- SUMMARY (dashboard cards) ----------
export const summaryReport = async (req, res) => {
  try {
    const { from, to } = getRange(req);
    const overall = await calcCogs(from, to);
    const [ord] = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
    ]);
    const [exp] = await Expense.aggregate([
      { $match: { expenseDate: { $gte: from, $lte: to } } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]);
    const [pur] = await Purchase.aggregate([
      { $match: { purchaseDate: { $gte: from, $lte: to } } },
      { $group: { _id: null, cost: { $sum: '$totalCost' }, due: { $sum: '$dueAmount' } } },
    ]);
    const [due] = await Order.aggregate([
      { $match: { paymentStatus: { $in: ['Pending', 'Failed'] }, orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: null, amount: { $sum: '$totalAmount' } } },
    ]);
    const revenue = ord?.revenue || 0;
    const gross = revenue - overall.cogs;
    const net = gross - (exp?.amount || 0);
    res.json({
      success: true,
      data: {
        revenue, orders: ord?.orders || 0, cogs: overall.cogs, gross,
        expenses: exp?.amount || 0, net,
        purchaseCost: pur?.cost || 0, supplierDue: pur?.due || 0, customerDue: due?.amount || 0,
      },
      meta: meta(from, to),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

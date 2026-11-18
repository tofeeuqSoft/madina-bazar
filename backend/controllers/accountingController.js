import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import Expense from '../models/Expense.js';
import Purchase from '../models/Purchase.js';
import Supplier from '../models/Supplier.js';
import Return from '../models/Return.js';
import User from '../models/User.js';
import AccountingAccount from '../models/AccountingAccount.js';
import Journal from '../models/Journal.js';
import LedgerLine from '../models/LedgerLine.js';
import AccountingSettings from '../models/AccountingSettings.js';
import { calculateProfitLoss } from '../services/profitLossService.js';
import { calculateCashFlow } from '../services/cashFlowService.js';
import { accountBalance, voidJournal } from '../services/journalService.js';
import { ensureChartOfAccounts } from '../services/chartOfAccounts.js';
import { recordPayment, recordTransfer, methodToAccount } from '../services/accountingService.js';
import { logAudit } from '../utils/auditLog.js';

// ---------- shared helpers ----------

export const resolveRange = (query = {}) => {
  const { preset, from, to } = query;
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  const day = (d) => {
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const dayEnd = (d) => {
    d.setHours(23, 59, 59, 999);
    return d;
  };
  switch (preset) {
    case 'today':
      return { from: day(start), to: dayEnd(end) };
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      return { from: day(start), to: dayEnd(end) };
    case 'week': {
      const dow = (now.getDay() + 6) % 7; // Monday start
      start.setDate(start.getDate() - dow);
      return { from: day(start), to: dayEnd(end) };
    }
    case 'lastMonth': {
      const f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const t = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: day(f), to: dayEnd(t) };
    }
    case 'year':
      return { from: day(new Date(now.getFullYear(), 0, 1)), to: dayEnd(end) };
    case 'month':
      return { from: day(new Date(now.getFullYear(), now.getMonth(), 1)), to: dayEnd(end) };
    default:
      return {
        from: from ? day(new Date(from)) : day(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: to ? dayEnd(new Date(to)) : dayEnd(end),
      };
  }
};

const orderMatch = (range) => ({
  createdAt: { $gte: range.from, $lte: range.to },
  orderStatus: { $ne: 'Cancelled' },
});

// ---------- dashboard ----------

export const getDashboard = async (req, res) => {
  try {
    const range = resolveRange(req.query);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [dayAgg] = await Order.aggregate([
      { $match: orderMatch(range) },
      {
        $group: {
          _id: null,
          sales: { $sum: '$totalAmount' },
          revenue: { $sum: { $add: ['$subtotal', '$deliveryCharge', { $ifNull: ['$taxAmount', 0] }] } },
          orders: { $sum: 1 },
          deliveryRevenue: { $sum: '$deliveryCharge' },
        },
      },
    ]);

    const today = (() => {
      const s = new Date();
      s.setHours(0, 0, 0, 0);
      const e = new Date();
      e.setHours(23, 59, 59, 999);
      return { from: s, to: e };
    })();
    const [todayAgg] = await Order.aggregate([
      { $match: orderMatch(today) },
      { $group: { _id: null, sales: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
    ]);

    const [expAgg] = await Expense.aggregate([
      { $match: { expenseDate: { $gte: range.from, $lte: range.to }, status: { $ne: 'VOIDED' } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const [expToday] = await Expense.aggregate([
      { $match: { expenseDate: { $gte: today.from, $lte: today.to }, status: { $ne: 'VOIDED' } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const pnl = await calculateProfitLoss(range);
    const [pendingPay] = await Order.aggregate([
      { $match: { ...orderMatch(range), paymentStatus: { $in: ['Pending', 'Failed'] } } },
      { $group: { _id: null, due: { $sum: { $subtract: ['$totalAmount', { $ifNull: ['$paidAmount', 0] }] } }, count: { $sum: 1 } } },
    ]);
    const [refundAgg] = await Return.aggregate([
      { $match: { createdAt: { $gte: range.from, $lte: range.to }, status: { $in: ['Requested', 'Approved'] } } },
      { $group: { _id: null, pending: { $sum: '$refundAmount' }, count: { $sum: 1 } } },
    ]);
    const [supAgg] = await Purchase.aggregate([
      { $match: {} },
      { $group: { _id: null, payable: { $sum: '$dueAmount' } } },
    ]);
    const [custAgg] = await Order.aggregate([
      { $match: orderMatch(range) },
      { $group: { _id: null, recv: { $sum: { $subtract: ['$totalAmount', { $ifNull: ['$paidAmount', 0] }] } } } },
    ]);
    const [gwAgg] = await Payment.aggregate([
      { $match: { createdAt: { $gte: range.from, $lte: range.to }, status: 'PENDING', paymentMethod: { $in: ['BKASH', 'NAGAD', 'SSLCOMMERZ'] } } },
      { $group: { _id: null, pending: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    const [cash, bank, bkash, nagad] = await Promise.all([
      accountBalance('CASH'), accountBalance('BANK'), accountBalance('BKASH'), accountBalance('NAGAD'),
    ]);

    // Charts (last 14 days sales, last 12 months revenue, expense by category, pay-method split)
    const daily = await Order.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 14 * 864e5) }, orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, sales: { $sum: '$totalAmount' } } },
      { $sort: { _id: 1 } },
    ]);
    const monthly = await Order.aggregate([
      { $match: { createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1) }, orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { _id: 1 } },
    ]);
    const expByCat = await Expense.aggregate([
      { $match: { expenseDate: { $gte: range.from, $lte: range.to }, status: { $ne: 'VOIDED' } } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]);
    const payByMethod = await Payment.aggregate([
      { $match: { createdAt: { $gte: range.from, $lte: range.to }, status: 'PAID' } },
      { $group: { _id: '$paymentMethod', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);
    const profitByDay = await Order.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 14 * 864e5) }, orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: { $subtract: ['$totalAmount', { $ifNull: ['$discount', 0] }] } } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        today: {
          sales: todayAgg?.sales || 0,
          orders: todayAgg?.orders || 0,
          expense: expToday?.total || 0,
          profit: (todayAgg?.sales || 0) - (expToday?.total || 0),
          revenue: todayAgg?.sales || 0,
        },
        period: {
          sales: dayAgg?.sales || 0,
          revenue: dayAgg?.revenue || 0,
          expense: expAgg?.total || 0,
          orders: dayAgg?.orders || 0,
          deliveryRevenue: dayAgg?.deliveryRevenue || 0,
          grossProfit: pnl.result.gross,
          netProfit: pnl.result.net,
        },
        dues: {
          pendingPayments: { count: pendingPay?.count || 0, amount: pendingPay?.due || 0 },
          refundPending: { count: refundAgg?.count || 0, amount: refundAgg?.pending || 0 },
          supplierPayable: supAgg?.payable || 0,
          customerReceivable: custAgg?.recv || 0,
          gatewayPending: { count: gwAgg?.count || 0, amount: gwAgg?.pending || 0 },
        },
        balances: { cash, bank, bkash, nagad },
        charts: { daily, monthly, expByCat, payByMethod, profitByDay },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- sales & orders accounting ----------

export const getSales = async (req, res) => {
  try {
    const range = resolveRange(req.query);
    const { page = 1, limit = 20 } = req.query;
    const match = orderMatch(range);
    const skip = (Number(page) - 1) * Number(limit);

    const [summary] = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          subtotal: { $sum: '$subtotal' },
          discount: { $sum: '$discount' },
          delivery: { $sum: '$deliveryCharge' },
          tax: { $sum: { $ifNull: ['$taxAmount', 0] } },
          refunds: { $sum: 0 },
          total: { $sum: '$totalAmount' },
          paid: { $sum: { $ifNull: ['$paidAmount', 0] } },
        },
      },
    ]);

    const [refAgg] = await Return.aggregate([
      { $match: { createdAt: { $gte: range.from, $lte: range.to }, status: { $in: ['Approved', 'Refunded'] } } },
      { $group: { _id: null, amount: { $sum: '$refundAmount' } } },
    ]);

    const [list, total] = await Promise.all([
      Order.find(match)
        .populate('customer', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('orderNumber customer createdAt subtotal discount deliveryCharge taxAmount totalAmount paidAmount paymentStatus orderStatus paymentMethod couponCode'),
      Order.countDocuments(match),
    ]);

    const rows = list.map((o) => ({
      _id: o._id,
      orderNumber: o.orderNumber,
      customer: o.customer,
      date: o.createdAt,
      subtotal: o.subtotal,
      discount: o.discount,
      delivery: o.deliveryCharge,
      tax: o.taxAmount || 0,
      total: o.totalAmount,
      paid: o.paidAmount || 0,
      due: Math.max(0, (o.totalAmount || 0) - (o.paidAmount || 0)),
      payStatus: derivedPayStatus(o),
      orderStatus: o.orderStatus,
      paymentMethod: o.paymentMethod,
    }));

    res.json({
      success: true,
      data: {
        summary: {
          orders: summary?.orders || 0,
          subtotal: summary?.subtotal || 0,
          discount: summary?.discount || 0,
          delivery: summary?.delivery || 0,
          tax: summary?.tax || 0,
          refunds: refAgg?.amount || 0,
          total: summary?.total || 0,
          paid: summary?.paid || 0,
          due: Math.max(0, (summary?.total || 0) - (summary?.paid || 0)),
        },
        rows,
      },
      meta: { page: Number(page), pages: Math.ceil(total / Number(limit)), total },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const derivedPayStatus = (o) => {
  if (o.paymentStatus === 'Refunded') return o.paidAmount > 0 ? 'PARTIALLY_REFUNDED' : 'REFUNDED';
  if (o.orderStatus === 'Cancelled') return 'CANCELLED';
  const paid = o.paidAmount || 0;
  if (paid <= 0) return o.paymentStatus === 'Failed' ? 'FAILED' : 'UNPAID';
  if (paid < (o.totalAmount || 0)) return 'PARTIALLY_PAID';
  return 'PAID';
};

// ---------- payments ----------

export const getPayments = async (req, res) => {
  try {
    const { status, method, page = 1, limit = 20, from, to } = req.query;
    const q = {};
    if (status) q.status = status;
    if (method) q.paymentMethod = method;
    if (from || to) q.createdAt = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
    const skip = (Number(page) - 1) * Number(limit);
    const [list, total] = await Promise.all([
      Payment.find(q).populate('order', 'orderNumber totalAmount').populate('customer', 'name phone').populate('verifiedBy', 'name')
        .sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Payment.countDocuments(q),
    ]);
    res.json({ success: true, data: list, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createPayment = async (req, res) => {
  try {
    const { orderId, amount, paymentMethod, transactionId, note } = req.body;
    if (!orderId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Order and positive amount are required' });
    }
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const payment = await Payment.create({
      order: order._id,
      customer: order.customer,
      amount,
      paymentMethod: (paymentMethod || order.paymentMethod || 'COD').toUpperCase(),
      transactionId: transactionId || '',
      status: 'PENDING',
      note: note || 'Manual payment entry',
      createdBy: req.user.id,
    });
    logAudit(req, { action: 'PAYMENT_CREATED', entity: 'Payment', entityId: payment._id, entityName: payment.paymentId, details: { order: order.orderNumber, amount } });
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Verify → PAID (posts journals + rolls up order.paidAmount)
export const verifyPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.status === 'PAID') return res.status(400).json({ success: false, message: 'Already paid' });
    if (['CANCELLED', 'REFUNDED'].includes(payment.status)) {
      return res.status(400).json({ success: false, message: `Cannot verify a ${payment.status} payment` });
    }
    const order = await Order.findById(payment.order);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    payment.status = 'PAID';
    payment.verifiedBy = req.user.id;
    payment.paidAt = new Date();
    await payment.save();

    // Ensure sale posted, then payment (idempotent guards inside)
    const { recordSale, postPaymentJournal, refreshOrderPaid } = await import('../services/accountingService.js');
    await recordSale(order, { actorId: req.user.id, req });
    await postPaymentJournal(payment, order, { actorId: req.user.id, req });
    await refreshOrderPaid(order);

    const fresh = await Order.findById(order._id);
    logAudit(req, { action: 'PAYMENT_UPDATED', entity: 'Payment', entityId: payment._id, entityName: payment.paymentId, details: { status: 'PAID', orderPaid: fresh.paidAmount } });
    res.json({ success: true, message: 'Payment verified and posted', data: payment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const failPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.status === 'PAID') return res.status(400).json({ success: false, message: 'Paid payments cannot fail — refund instead' });
    payment.status = req.body.status === 'CANCELLED' ? 'CANCELLED' : 'FAILED';
    await payment.save();
    logAudit(req, { action: 'PAYMENT_UPDATED', entity: 'Payment', entityId: payment._id, entityName: payment.paymentId, details: { status: payment.status } });
    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- ledger & journals ----------

export const getLedger = async (req, res) => {
  try {
    const { account, from, to, page = 1, limit = 50, ref } = req.query;
    const q = {};
    if (account) q.code = String(account).toUpperCase();
    if (ref) {
      const { escapeRegExp } = await import('../utils/safeRegex.js');
      q.$or = [{ referenceId: ref }, { voucherNo: { $regex: escapeRegExp(ref), $options: 'i' } }];
    }
    if (from || to) q.date = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
    const skip = (Number(page) - 1) * Number(limit);
    const [lines, total] = await Promise.all([
      LedgerLine.find(q).populate('account', 'name type').sort({ date: -1, _id: -1 }).skip(skip).limit(Number(limit)),
      LedgerLine.countDocuments(q),
    ]);
    res.json({ success: true, data: lines, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getJournals = async (req, res) => {
  try {
    const { module, status, page = 1, limit = 20, from, to } = req.query;
    const q = {};
    if (module) q.module = module;
    if (status) q.status = status;
    if (from || to) q.date = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
    const skip = (Number(page) - 1) * Number(limit);
    const [list, total] = await Promise.all([
      Journal.find(q).populate('createdBy', 'name').sort({ date: -1, _id: -1 }).skip(skip).limit(Number(limit)),
      Journal.countDocuments(q),
    ]);
    res.json({ success: true, data: list, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const voidJournalEntry = async (req, res) => {
  try {
    const { reason = '' } = req.body;
    const { original, reversal } = await voidJournal(req.params.id, { by: req.user.id, reason });
    logAudit(req, { action: 'JOURNAL_VOIDED', entity: 'Journal', entityId: original._id, entityName: original.voucherNo, details: { reason, reversal: reversal.voucherNo } });
    res.json({ success: true, message: 'Journal voided via reversal', data: { original, reversal } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getTrialBalance = async (req, res) => {
  try {
    const { activeJournalIds } = await import('../services/journalService.js');
    const ids = await activeJournalIds();
    const match = { journal: { $in: ids } };
    if (req.query.from || req.query.to) {
      match.date = {};
      if (req.query.from) match.date.$gte = new Date(req.query.from);
      if (req.query.to) match.date.$lte = new Date(req.query.to);
    }
    const rows = await LedgerLine.aggregate([
      { $match: match },
      { $group: { _id: '$code', debit: { $sum: '$debit' }, credit: { $sum: '$credit' } } },
      { $sort: { _id: 1 } },
    ]);
    const totals = rows.reduce(
      (s, r) => ({ debit: s.debit + r.debit, credit: s.credit + r.credit }),
      { debit: 0, credit: 0 }
    );
    res.json({
      success: true,
      data: { rows, totals, balanced: Math.abs(totals.debit - totals.credit) < 0.01 },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- statements ----------

export const getProfitLoss = async (req, res) => {
  try {
    const range = resolveRange({ preset: req.query.preset, from: req.query.from, to: req.query.to });
    const pnl = await calculateProfitLoss(range);
    res.json({ success: true, data: { ...pnl, range } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCashFlow = async (req, res) => {
  try {
    const range = resolveRange({ preset: req.query.preset, from: req.query.from, to: req.query.to });
    const cf = await calculateCashFlow(range);
    res.json({ success: true, data: { ...cf, range } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTaxReport = async (req, res) => {
  try {
    const range = resolveRange({ preset: req.query.preset, from: req.query.from, to: req.query.to });
    const settings = await AccountingSettings.findOne().sort({ updatedAt: -1 }).lean();
    const { activeJournalIds } = await import('../services/journalService.js');
    const activeIds = await activeJournalIds();
    const [collected] = await LedgerLine.aggregate([
      { $match: { code: 'TAX_PAYABLE', journal: { $in: activeIds }, date: { $gte: range.from, $lte: range.to } } },
      { $group: { _id: null, credit: { $sum: '$credit' }, debit: { $sum: '$debit' } } },
    ]);
    const [orderTax] = await Order.aggregate([
      { $match: { createdAt: { $gte: range.from, $lte: range.to }, orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: null, tax: { $sum: { $ifNull: ['$taxAmount', 0] } }, orders: { $sum: 1 } } },
    ]);
    res.json({
      success: true,
      data: {
        rate: settings?.taxRate || 0,
        name: settings?.taxName || 'VAT',
        collected: collected?.credit || 0,
        adjusted: collected?.debit || 0,
        payable: (collected?.credit || 0) - (collected?.debit || 0),
        orderSnapshots: orderTax?.tax || 0,
        orders: orderTax?.orders || 0,
        range,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- customers & suppliers ----------

export const getCustomers = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const match = { orderStatus: { $ne: 'Cancelled' } };
    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: '$customer',
          orders: { $sum: 1 },
          purchase: { $sum: '$totalAmount' },
          paid: { $sum: { $ifNull: ['$paidAmount', 0] } },
          refund: { $sum: 0 },
        },
      },
      { $sort: { purchase: -1 } },
      { $skip: (Number(page) - 1) * Number(limit) },
      { $limit: Number(limit) },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
    ];
    if (search) {
      pipeline.unshift({
        $lookup: { from: 'users', localField: 'customer', foreignField: '_id', as: 'su' },
      });
    }
    const rows = await Order.aggregate(pipeline);
    let filtered = rows;
    if (search) {
      const s = String(search).toLowerCase();
      filtered = rows.filter(
        (r) => (r.u?.name || '').toLowerCase().includes(s) || (r.u?.phone || '').includes(s)
      );
    }
    // refunds per customer
    const refunds = await Return.aggregate([
      { $match: { status: { $in: ['Approved', 'Refunded'] } } },
      {
        $lookup: {
          from: 'orders', localField: 'order', foreignField: '_id', as: 'o',
        },
      },
      { $unwind: '$o' },
      { $group: { _id: '$o.customer', refund: { $sum: '$refundAmount' } } },
    ]);
    const refMap = Object.fromEntries(refunds.map((r) => [String(r._id), r.refund]));
    const data = filtered.map((r) => ({
      _id: r._id,
      name: r.u?.name || 'Unknown',
      phone: r.u?.phone || '',
      email: r.u?.email || '',
      orders: r.orders,
      purchase: r.purchase,
      paid: r.paid,
      refund: refMap[String(r._id)] || 0,
      due: Math.max(0, r.purchase - r.paid),
      receivable: Math.max(0, r.purchase - r.paid),
    }));
    const total = await Order.distinct('customer', match).then((a) => a.length);
    res.json({ success: true, data, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCustomerAccount = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.params.id }).sort({ createdAt: -1 }).limit(50)
      .select('orderNumber createdAt totalAmount paidAmount paymentStatus orderStatus');
    const payments = await Payment.find({ customer: req.params.id }).sort({ createdAt: -1 }).limit(50);
    const purchase = orders.filter((o) => o.orderStatus !== 'Cancelled').reduce((s, o) => s + (o.totalAmount || 0), 0);
    const paid = orders.reduce((s, o) => s + (o.paidAmount || 0), 0);
    res.json({ success: true, data: { orders, payments, summary: { purchase, paid, due: Math.max(0, purchase - paid) } } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSupplierAccount = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    const purchases = await Purchase.find({ supplier: supplier._id }).sort({ purchaseDate: -1 });
    const total = purchases.reduce((s, p) => s + (p.totalCost || 0), 0);
    const paid = purchases.reduce((s, p) => s + (p.paidAmount || 0), 0);
    const ret = await Return.aggregate([
      { $match: { type: 'PURCHASE_RETURN', status: { $in: ['Approved', 'Refunded'] } } },
      { $group: { _id: null, amount: { $sum: '$refundAmount' } } },
    ]);
    const journals = await Journal.find({ referenceType: 'Purchase', status: 'POSTED' })
      .sort({ date: -1 }).limit(50).select('voucherNo date narration totalDebit module');
    res.json({
      success: true,
      data: {
        supplier,
        summary: {
          totalPurchase: total,
          totalPaid: paid,
          purchaseReturn: ret[0]?.amount || 0,
          payable: Math.max(0, total - paid),
        },
        purchases,
        journals,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- cash & bank ----------

export const getAccounts = async (req, res) => {
  try {
    await ensureChartOfAccounts();
    const accounts = await AccountingAccount.find({ type: { $in: ['Asset', 'Liability'] }, isActive: true }).sort({ type: 1, code: 1 });
    const withBalances = await Promise.all(
      accounts.map(async (a) => ({
        _id: a._id,
        code: a.code,
        name: a.name,
        type: a.type,
        isSystem: a.isSystem,
        balance: await accountBalance(a.code),
      }))
    );
    res.json({ success: true, data: withBalances });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createAccount = async (req, res) => {
  try {
    const { code, name, type } = req.body;
    if (!code || !name || !type) return res.status(400).json({ success: false, message: 'Code, name and type are required' });
    if (!['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid account type' });
    }
    const acc = await AccountingAccount.create({ code: String(code).toUpperCase(), name, type });
    logAudit(req, { action: 'ACCOUNT_CREATED', entity: 'Account', entityId: acc._id, entityName: acc.code });
    res.status(201).json({ success: true, data: acc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.code === 11000 ? 'Code already exists' : error.message });
  }
};

export const updateAccount = async (req, res) => {
  try {
    const acc = await AccountingAccount.findById(req.params.id);
    if (!acc) return res.status(404).json({ success: false, message: 'Account not found' });
    if (req.body.name && !acc.isSystem) acc.name = req.body.name;
    if (req.body.isActive !== undefined && !acc.isSystem) acc.isActive = !!req.body.isActive;
    await acc.save();
    logAudit(req, { action: 'ACCOUNT_UPDATED', entity: 'Account', entityId: acc._id, entityName: acc.code });
    res.json({ success: true, data: acc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const transferFunds = async (req, res) => {
  try {
    const { fromCode, toCode, amount, note } = req.body;
    const { recordTransfer } = await import('../services/accountingService.js');
    const journal = await recordTransfer({ fromCode, toCode, amount, note, actorId: req.user.id, req });
    res.status(201).json({ success: true, data: journal });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getAccountTxns = async (req, res) => {
  try {
    const { page = 1, limit = 30, from, to } = req.query;
    const q = { code: String(req.params.code).toUpperCase() };
    if (from || to) q.date = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
    const skip = (Number(page) - 1) * Number(limit);
    const [lines, total] = await Promise.all([
      LedgerLine.find(q).sort({ date: -1, _id: -1 }).skip(skip).limit(Number(limit)),
      LedgerLine.countDocuments(q),
    ]);
    res.json({ success: true, data: lines, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- delivery accounting (from centralized delivery data) ----------

export const getDeliveryAccounting = async (req, res) => {
  try {
    const range = resolveRange(req.query);
    const match = { ...orderMatch(range) };
    const [agg] = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          revenue: { $sum: '$deliveryCharge' },
          freeCount: { $sum: { $cond: [{ $eq: ['$deliveryCharge', 0] }, 1, 0] } },
        },
      },
    ]);
    // Delivery expense = Delivery-category expenses + purchase transport fallback
    const [exp] = await Expense.aggregate([
      { $match: { expenseDate: { $gte: range.from, $lte: range.to }, status: { $ne: 'VOIDED' }, category: { $in: ['Delivery', 'Transport'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    // Journal-sourced revenue (audited) for cross-check
    const [jRev] = await LedgerLine.aggregate([
      { $match: { code: 'DELIVERY_REVENUE', date: { $gte: range.from, $lte: range.to } } },
      { $group: { _id: null, total: { $sum: '$credit' } } },
    ]);
    const revenue = agg?.revenue || 0;
    const expense = exp?.total || 0;
    res.json({
      success: true,
      data: {
        orders: agg?.orders || 0,
        revenue,
        journalRevenue: jRev?.total || 0,
        expense,
        freeCount: agg?.freeCount || 0,
        margin: revenue - expense,
        marginPct: revenue ? +(((revenue - expense) / revenue) * 100).toFixed(2) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- settings ----------

export const getAccSettings = async (req, res) => {
  try {
    await ensureChartOfAccounts();
    let s = await AccountingSettings.findOne().sort({ updatedAt: -1 });
    if (!s) s = await AccountingSettings.create({});
    const accounts = await AccountingAccount.find({ isActive: true }).sort({ type: 1, code: 1 }).select('code name type isSystem');
    res.json({ success: true, data: { settings: s, accounts } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAccSettings = async (req, res) => {
  try {
    let s = await AccountingSettings.findOne().sort({ updatedAt: -1 });
    if (!s) s = new AccountingSettings();
    const { taxRate, taxName, vatMode, vatBin, gatewayFees, paymentMethods, expenseCategories, expenseAccountMap, fiscalYearStartMonth } = req.body;
    if (taxRate !== undefined) s.taxRate = Math.min(100, Math.max(0, Number(taxRate)));
    if (taxName !== undefined) s.taxName = String(taxName);
    if (vatMode !== undefined) {
      if (!['DISABLED', 'EXCLUSIVE', 'INCLUSIVE'].includes(vatMode)) {
        return res.status(400).json({ success: false, message: 'Invalid VAT mode' });
      }
      s.vatMode = vatMode;
    }
    if (vatBin !== undefined) s.vatBin = String(vatBin).trim();
    if (gatewayFees !== undefined) s.gatewayFees = gatewayFees;
    if (paymentMethods !== undefined) s.paymentMethods = paymentMethods;
    if (expenseCategories !== undefined) s.expenseCategories = expenseCategories;
    if (expenseAccountMap !== undefined) s.expenseAccountMap = expenseAccountMap;
    if (fiscalYearStartMonth !== undefined) s.fiscalYearStartMonth = Number(fiscalYearStartMonth);
    s.updatedBy = req.user.id;
    await s.save();
    logAudit(req, { action: 'ACCOUNT_UPDATED', entity: 'AccountingSettings', entityName: 'settings', details: req.body });
    res.json({ success: true, data: s });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- repair (backfill missing journals, idempotent) ----------

export const repairPostings = async (req, res) => {
  try {
    await ensureChartOfAccounts();
    const { recordSale, recordExpense, recordPurchase, postPaymentJournal, refreshOrderPaid } = await import('../services/accountingService.js');
    let fixed = { sales: 0, expenses: 0, purchases: 0, payments: 0, legacyKinds: 0 };

    const paidOrders = await Order.find({ paymentStatus: 'Paid', orderStatus: { $ne: 'Cancelled' } }).limit(500);
    for (const o of paidOrders) {
      const exists = await Journal.findOne({ refKey: `SALE:Order:${o._id}:SALE` });
      if (!exists) {
        await recordSale(o, { actorId: req.user.id, req });
        fixed.sales++;
      }
    }
    const expenses = await Expense.find({ status: { $ne: 'VOIDED' } }).limit(500);
    for (const e of expenses) {
      const exists = await Journal.findOne({ refKey: `EXPENSE:Expense:${e._id}:MAIN` });
      if (!exists) {
        await recordExpense(e, { actorId: req.user.id, req });
        fixed.expenses++;
      }
    }
    const purchases = await Purchase.find({}).limit(500);
    for (const p of purchases) {
      const exists = await Journal.findOne({ refKey: `PURCHASE:Purchase:${p._id}:MAIN` });
      if (!exists) {
        await recordPurchase(p, { actorId: req.user.id, req });
        fixed.purchases++;
      }
    }
    // PAID payments missing their money-movement journal (e.g. verified
    // before the verify-flow posted journals) + order rollup refresh
    const paidPayments = await Payment.find({ status: 'PAID' }).limit(500);
    for (const pay of paidPayments) {
      const exists = await Journal.findOne({ refKey: `PAYMENT:Payment:${pay.paymentId}:MAIN` });
      if (!exists) {
        const order = await Order.findById(pay.order);
        if (order) {
          await recordSale(order, { actorId: req.user.id, req });
          await postPaymentJournal(pay, order, { actorId: req.user.id, req });
          await refreshOrderPaid(order);
          fixed.payments++;
        }
      }
    }
    // One-time: tag legacy reversals (created before `kind` existed) so
    // statements exclude void pairs correctly going forward
    const legacy = await Journal.updateMany(
      { $or: [{ kind: { $exists: false } }, { kind: 'MAIN' }], narration: /^Reversal of / },
      { $set: { kind: 'VOID:legacy' } }
    );
    fixed.legacyKinds = legacy.modifiedCount || 0;
    logAudit(req, { action: 'JOURNAL_CREATED', entity: 'Repair', entityName: 'backfill', details: fixed });
    res.json({ success: true, message: 'Repair complete', data: fixed });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

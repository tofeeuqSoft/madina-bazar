import Payment from '../models/Payment.js';
import Order from '../models/Order.js';
import AccountingSettings from '../models/AccountingSettings.js';
import { postJournal } from './journalService.js';
import { logAudit } from '../utils/auditLog.js';

// Payment method → asset account code (configurable list, fixed mapping)
export const methodToAccount = (method) => {
  const m = String(method || 'COD').toUpperCase();
  if (m === 'BKASH') return 'BKASH';
  if (m === 'NAGAD') return 'NAGAD';
  if (['BANK', 'CARD', 'SSLCOMMERZ'].includes(m)) return 'BANK';
  if (m === 'GATEWAY') return 'GATEWAY';
  return 'CASH'; // COD, CASH, OTHER
};

export const gatewayFeeFor = async (method, amount) => {
  const s = await AccountingSettings.findOne().sort({ updatedAt: -1 }).lean();
  const pct = Number(s?.gatewayFees?.get?.(String(method).toUpperCase()) ?? s?.gatewayFees?.[String(method).toUpperCase()] ?? 0);
  return Math.round(((Number(amount) || 0) * pct) / 100 * 100) / 100;
};

const failAudit = (req, action, message, details = {}) => {
  try {
    logAudit(req, { action: `${action}_FAILED`, entity: 'Accounting', details: { message, ...details } });
  } catch (_) {}
  console.error(`[accounting] ${action} failed:`, message);
};

/**
 * Recompute order.paidAmount from PAID payments (server-side truth for due).
 */
export const refreshOrderPaid = async (order) => {
  const agg = await Payment.aggregate([
    { $match: { order: order._id, status: 'PAID' } },
    { $group: { _id: null, paid: { $sum: '$amount' } } },
  ]);
  order.paidAmount = agg[0]?.paid || 0;
  await order.save({ validateBeforeSave: false });
  return order.paidAmount;
};

/**
 * Post the money-movement journal for an already-created PAID payment.
 * Used by recordPayment (new) AND verify flow (PENDING→PAID transition).
 */
export const postPaymentJournal = async (payment, order, { actorId, req } = {}) => {
  const asset = methodToAccount(payment.paymentMethod);
  const entries = [{ accountCode: asset, debit: payment.amount }];
  if ((payment.gatewayFee || 0) > 0) {
    entries.push({ accountCode: 'GATEWAY_FEE', debit: payment.gatewayFee });
    entries.push({ accountCode: asset, credit: payment.gatewayFee });
  }
  entries.push({ accountCode: 'ACC_RECEIVABLE', credit: payment.amount });
  try {
    await postJournal({
      date: payment.paidAt || new Date(),
      module: 'PAYMENT',
      referenceType: 'Payment',
      referenceId: payment.paymentId,
      narration: `Payment ${payment.paymentId} for order ${order.orderNumber}`,
      entries,
      actorId,
    });
  } catch (e) {
    // Idempotent refKey → duplicate means already posted, not an error
    if (!/duplicate|E11000/i.test(e.message)) {
      failAudit(req, 'PAYMENT_POST', e.message, { paymentId: payment.paymentId });
    }
  }
};
 
/**
 * Record a payment against an order (idempotent per order+amount+method+txn).
 * Posts: Dr PaymentAsset / Cr ACC_RECEIVABLE (+ fee legs).
 * Receivable is created by recordSale (revenue on credit) so books stay clean
 * even when payment arrives later (bKash) or never (COD due).
 */
export const recordPayment = async (order, { amount, method, txnId = '', actorId, note = '', req } = {}) => {
  const amt = Math.round((Number(amount) || 0) * 100) / 100;
  if (amt <= 0) throw new Error('Invalid payment amount');

  const dup = await Payment.findOne({
    order: order._id, amount: amt, paymentMethod: String(method || 'COD').toUpperCase(), transactionId: txnId || '',
  });
  if (dup) return { payment: dup, created: false };

  const fee = await gatewayFeeFor(method, amt);
  const payment = await Payment.create({
    order: order._id,
    customer: order.customer,
    amount: amt,
    paymentMethod: String(method || 'COD').toUpperCase(),
    transactionId: txnId,
    gatewayFee: fee,
    netReceived: Math.max(0, amt - fee),
    status: 'PAID',
    paidAt: new Date(),
    note,
    createdBy: actorId,
  });

  // Post money movement (extracted helper keeps verify-flow identical)
  await postPaymentJournal(payment, order, { actorId, req });

  // Roll up paid amount on order (server-side truth for due)
  await refreshOrderPaid(order);

  try {
    logAudit(req, { action: 'PAYMENT_CREATED', entity: 'Payment', entityId: payment._id, entityName: payment.paymentId, details: { order: order.orderNumber, amount: amt, method } });
  } catch (_) {}
  return { payment, created: true };
};

/**
 * Record the sale itself (revenue + receivable + COGS + tax).
 * Called once per order — idempotent via refKey. Uses ORDER SNAPSHOTS
 * (subtotal/discount/delivery/tax/cost), never live product prices.
 */
export const recordSale = async (order, { actorId, req } = {}) => {
  const o = order.toObject ? order.toObject() : order;
  const productRevenue = Math.max(0, (o.subtotal || 0) - (o.discount || 0));
  const deliveryRevenue = o.deliveryCharge || 0;
  const tax = o.taxAmount || 0;
  const cogs = (o.orderItems || []).reduce((s, i) => s + (Number(i.cost) || 0) * (Number(i.quantity) || 0), 0);

  try {
    const entries = [
      { accountCode: 'ACC_RECEIVABLE', debit: productRevenue + deliveryRevenue + tax },
    ];
    if (productRevenue > 0) entries.push({ accountCode: 'SALES_REVENUE', credit: productRevenue });
    if (deliveryRevenue > 0) entries.push({ accountCode: 'DELIVERY_REVENUE', credit: deliveryRevenue });
    if (tax > 0) entries.push({ accountCode: 'TAX_PAYABLE', credit: tax });
    await postJournal({
      date: o.createdAt || new Date(),
      module: 'SALE',
      referenceType: 'Order',
      referenceId: String(o._id),
      kind: 'SALE',
      narration: `Sale ${o.orderNumber} — revenue + receivable`,
      entries,
      actorId,
    });

    if (cogs > 0) {
      await postJournal({
        date: o.createdAt || new Date(),
        module: 'SALE',
        referenceType: 'Order',
        referenceId: String(o._id),
        kind: 'COGS',
        narration: `COGS ${o.orderNumber}`,
        entries: [
          { accountCode: 'COGS', debit: cogs },
          { accountCode: 'INVENTORY', credit: cogs },
        ],
        actorId,
      });
    }
    return { posted: true };
  } catch (e) {
    failAudit(req, 'SALE_POST', e.message, { order: o.orderNumber });
    return { posted: false, error: e.message };
  }
};

/**
 * Sale adjustment for cancelled/swapped lines (credit-note style).
 * - revenueDelta > 0: Dr SALES_RETURNS / Cr RECEIVABLE (unpaid value taken off books)
 * - cogsDelta > 0: Dr INVENTORY / Cr COGS (goods back in stock)
 * Paid orders: money-back flows via recordRefund — pass revenueDelta 0 there
 * and only reverse COGS. Idempotent per (order, lineRef) via refKey.
 */
export const recordSaleAdjustment = async ({ order, lineRef = '', revenueDelta = 0, cogsDelta = 0, reason = '', actorId, req } = {}) => {
  const o = order.toObject ? order.toObject() : order;
  const rev = Math.round((Number(revenueDelta) || 0) * 100) / 100;
  const cogs = Math.round((Number(cogsDelta) || 0) * 100) / 100;
  if (rev === 0 && cogs === 0) return { posted: false, skipped: true };
  const ref = `${o._id}:${lineRef || 'line'}`;
  // Only reverse what was recognized: sale+COGS post at Confirm; a Pending
  // order has no sale entry yet (confirm reads the already-reduced totals).
  const Journal = (await import('../models/Journal.js')).default;
  const salePosted = await Journal.findOne({ refKey: `SALE:Order:${o._id}:SALE` }).select('_id').lean();
  if (!salePosted) return { posted: false, skipped: true, reason: 'sale-not-posted' };
  try {
    if (rev !== 0) {
      const a = Math.abs(rev);
      await postJournal({
        date: new Date(), module: 'SALE', referenceType: 'Order', referenceId: ref, kind: 'SALE-ADJ-REV',
        narration: `${rev > 0 ? 'Sale reversal' : 'Sale recognition'} ৳${a} ${o.orderNumber} — ${reason}`,
        entries: rev > 0
          ? [{ accountCode: 'SALES_RETURNS', debit: a }, { accountCode: 'ACC_RECEIVABLE', credit: a }]
          : [{ accountCode: 'ACC_RECEIVABLE', debit: a }, { accountCode: 'SALES_REVENUE', credit: a }],
        actorId,
      });
    }
    if (cogs !== 0) {
      const a = Math.abs(cogs);
      await postJournal({
        date: new Date(), module: 'SALE', referenceType: 'Order', referenceId: ref, kind: 'SALE-ADJ-COGS',
        narration: `${cogs > 0 ? 'COGS reversal' : 'COGS charge'} ৳${a} ${o.orderNumber} — ${reason}`,
        entries: cogs > 0
          ? [{ accountCode: 'INVENTORY', debit: a }, { accountCode: 'COGS', credit: a }]
          : [{ accountCode: 'COGS', debit: a }, { accountCode: 'INVENTORY', credit: a }],
        actorId,
      });
    }
    return { posted: true };
  } catch (e) {
    failAudit(req, 'SALE_ADJUST', e.message, { order: o.orderNumber, reason });
    return { posted: false, error: e.message };
  }
};

/**
 * Customer refund (full/partial): Dr Sales Returns / Cr payment asset.
 * Revenue reports use net (sales − returns).
 */
export const recordRefund = async ({ order, amount, method, reason = '', actorId, req, returnRef = '' }) => {
  const amt = Math.round((Number(amount) || 0) * 100) / 100;
  if (amt <= 0) throw new Error('Invalid refund amount');
  const asset = methodToAccount(method);
  const { journal } = await postJournal({
    module: 'REFUND',
    referenceType: 'Return',
    referenceId: String(returnRef || order?._id || Date.now()),
    narration: `Refund ৳${amt} ${order?.orderNumber ? `for ${order.orderNumber} ` : ''}${reason}`,
    entries: [
      { accountCode: 'SALES_RETURNS', debit: amt },
      { accountCode: asset, credit: amt },
    ],
    actorId,
  });
  try {
    logAudit(req, { action: 'REFUND_CREATED', entity: 'Refund', entityName: order?.orderNumber || '', details: { amount: amt, method, reason } });
  } catch (_) {}
  return journal;
};

/**
 * Expense: Dr mapped expense account / Cr cash/bank/mfs.
 * Category→account map comes from AccountingSettings (configurable).
 */
const DEFAULT_EXPENSE_MAP = {
  'Delivery Expense': 'DELIVERY_EXPENSE',
  'Employee Salary': 'SALARY_EXPENSE',
  Salary: 'SALARY_EXPENSE',
  'Office Rent': 'RENT_EXPENSE',
  Rent: 'RENT_EXPENSE',
  Electricity: 'UTILITY_EXPENSE',
  Internet: 'UTILITY_EXPENSE',
  Utility: 'UTILITY_EXPENSE',
  Packaging: 'PACKAGING_EXPENSE',
  Marketing: 'MARKETING_EXPENSE',
  Advertising: 'MARKETING_EXPENSE',
  'Software/API': 'OTHER_EXPENSE',
  Software: 'OTHER_EXPENSE',
  Warehouse: 'RENT_EXPENSE',
  Transport: 'DELIVERY_EXPENSE',
  Maintenance: 'OTHER_EXPENSE',
  'Purchase Related Expense': 'OTHER_EXPENSE',
  Purchase: 'OTHER_EXPENSE',
  'Bank Charge': 'GATEWAY_FEE',
  'Gateway Charge': 'GATEWAY_FEE',
  Refund: 'SALES_RETURNS',
  Other: 'OTHER_EXPENSE',
  'Other Expense': 'OTHER_EXPENSE',
};

export const recordExpense = async (expense, { actorId, req } = {}) => {
  const settings = await AccountingSettings.findOne().sort({ updatedAt: -1 }).lean();
  const custom = settings?.expenseAccountMap || {};
  const map = { ...DEFAULT_EXPENSE_MAP };
  if (custom instanceof Map) {
    for (const [k, v] of custom) map[k] = v;
  } else if (custom && typeof custom === 'object') {
    Object.assign(map, custom);
  }
  const code = map[expense.category] || 'OTHER_EXPENSE';
  const payAccount = methodToAccount(expense.paymentMethod);
  const { journal } = await postJournal({
    date: expense.expenseDate || expense.createdAt || new Date(),
    module: 'EXPENSE',
    referenceType: 'Expense',
    referenceId: String(expense._id),
    narration: `Expense: ${expense.title} (${expense.category})`,
    entries: [
      { accountCode: code, debit: expense.amount },
      { accountCode: payAccount, credit: expense.amount },
    ],
    actorId,
  });
  return journal;
};

/**
 * Purchase receive: Dr Inventory total / Cr Supplier Payable (due) + Cr cash (paid).
 */
export const recordPurchase = async (purchase, { actorId, req } = {}) => {
  const total = purchase.totalCost || 0;
  const paid = purchase.paidAmount || 0;
  const due = Math.max(0, total - paid);
  if (total <= 0) return null;
  const payAccount = methodToAccount(purchase.paymentMethod);
  const entries = [{ accountCode: 'INVENTORY', debit: total }];
  if (due > 0) entries.push({ accountCode: 'SUPPLIER_PAYABLE', credit: due });
  if (paid > 0) entries.push({ accountCode: payAccount, credit: paid });
  const { journal } = await postJournal({
    date: purchase.purchaseDate || purchase.createdAt || new Date(),
    module: 'PURCHASE',
    referenceType: 'Purchase',
    referenceId: String(purchase._id),
    narration: `Purchase ${purchase.invoiceNo || purchase._id} (supplier stock in)`,
    entries,
    actorId,
  });
  return journal;
};

/**
 * Supplier payment (delta-aware via purchase.accountingPaid):
 * Dr Supplier Payable / Cr cash. Updates accountingPaid marker.
 */
export const recordSupplierPayment = async (purchase, { amount, method, actorId, req } = {}) => {
  const amt = Math.round((Number(amount) || 0) * 100) / 100;
  if (amt <= 0) throw new Error('Invalid amount');
  const payAccount = methodToAccount(method || purchase.paymentMethod);
  const { journal } = await postJournal({
    module: 'PURCHASE',
    referenceType: 'Purchase',
    referenceId: String(purchase._id),
    kind: `SUPPAY:${Date.now()}`,
    narration: `Supplier payment ৳${amt} (${purchase.invoiceNo || purchase._id})`,
    entries: [
      { accountCode: 'SUPPLIER_PAYABLE', debit: amt },
      { accountCode: payAccount, credit: amt },
    ],
    actorId,
  });
  try {
    purchase.accountingPaid = Math.round(((purchase.accountingPaid || 0) + amt) * 100) / 100;
    await purchase.save({ validateBeforeSave: false });
    logAudit(req, { action: 'SUPPLIER_PAYMENT', entity: 'Purchase', entityId: purchase._id, entityName: purchase.invoiceNo || '', details: { amount: amt, method } });
  } catch (_) {}
  return journal;
};

/**
 * Account transfer (Cash → Bank etc.): Dr To / Cr From.
 */
export const recordTransfer = async ({ fromCode, toCode, amount, note = '', actorId, req }) => {
  const amt = Math.round((Number(amount) || 0) * 100) / 100;
  if (amt <= 0) throw new Error('Invalid amount');
  if (fromCode === toCode) throw new Error('Cannot transfer within the same account');
  const { journal } = await postJournal({
    module: 'TRANSFER',
    referenceType: 'Transfer',
    referenceId: `${fromCode}-${toCode}-${Date.now()}`,
    narration: `Transfer ৳${amt} ${fromCode} → ${toCode}${note ? ` — ${note}` : ''}`,
    entries: [
      { accountCode: toCode, debit: amt },
      { accountCode: fromCode, credit: amt },
    ],
    actorId,
  });
  return journal;
};

export default {
  methodToAccount,
  gatewayFeeFor,
  refreshOrderPaid,
  postPaymentJournal,
  recordPayment,
  recordSale,
  recordSaleAdjustment,
  recordRefund,
  recordExpense,
  recordPurchase,
  recordSupplierPayment,
  recordTransfer,
};

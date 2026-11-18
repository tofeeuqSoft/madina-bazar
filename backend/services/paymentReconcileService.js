import Order from '../models/Order.js';
import * as bkash from '../utils/bkash.js';
import * as nagad from '../utils/nagad.js';
import * as sslcommerz from '../utils/sslcommerz.js';
import { markOrderPaid, markOrderFailed } from './paymentFinalizeService.js';

// Pending-payment reconciler: gateway says Paid but callback never arrived
// (closed tab, lost net) → confirm from the gateway, not from hope.
// In-flight grace 15m (user may still be paying); hard-fail after 24h so
// Pending orders never rot. Gateway errors are SKIPPED (retried next run),
// never auto-failed — a timeout is not proof of non-payment.
const GRACE_MIN = Number(process.env.PAYMENT_RECONCILE_GRACE_MIN || 15);
const FAIL_AFTER_HOURS = Number(process.env.PAYMENT_RECONCILE_FAIL_HOURS || 24);

const queryGateway = async (order) => {
  const method = (order.paymentMethod || '').toUpperCase();
  const meta = order.paymentMeta || {};
  try {
    if (method === 'BKASH' && meta.paymentID) {
      const r = await bkash.queryPayment(meta.paymentID);
      if (r.transactionStatus === 'Completed' || r.statusCode === '0000' || r.trxID) {
        return { outcome: 'paid', gatewayTxnId: r.trxID || meta.paymentID, raw: r, note: `Paid via bKash (reconciled). TrxID: ${r.trxID || meta.paymentID}` };
      }
      return { outcome: 'pending', raw: r };
    }
    if (method === 'NAGAD' && meta.paymentRefId) {
      const v = await nagad.verifyPayment(meta.paymentRefId, order.orderNumber);
      const s = String(v?.status || '').toUpperCase();
      if (s === 'SUCCESS' || s === 'COMPLETED' || v?.statusCode === 'Success') {
        return { outcome: 'paid', gatewayTxnId: meta.paymentRefId, raw: v, note: `Paid via Nagad (reconciled). Ref: ${meta.paymentRefId}` };
      }
      return { outcome: 'pending', raw: v };
    }
    if (method === 'SSLCOMMERZ' && meta.valId) {
      const v = await sslcommerz.validatePayment(meta.valId);
      if (v.status === 'VALID' || v.status === 'VALIDATED') {
        return { outcome: 'paid', gatewayTxnId: v.bank_tran_id || meta.tranId, raw: v, note: `Paid via SSLCommerz (reconciled). Bank Trx: ${v.bank_tran_id || meta.valId}` };
      }
      return { outcome: 'pending', raw: v };
    }
    return { outcome: 'unknown' };
  } catch (e) {
    return { outcome: 'error', error: e.message };
  }
};

export const reconcilePendingPayments = async ({ actor = null, limit = 50 } = {}) => {
  const now = Date.now();
  const staleAfter = new Date(now - FAIL_AFTER_HOURS * 3600000);
  const candidates = await Order.find({
    paymentStatus: 'Pending',
    paymentMethod: { $in: ['BKASH', 'NAGAD', 'SSLCOMMERZ'] },
    createdAt: { $lt: new Date(now - GRACE_MIN * 60000) },
  }).sort({ createdAt: 1 }).limit(limit);

  const report = { checked: candidates.length, confirmed: 0, failed: 0, skipped: 0, errors: [] };
  for (const order of candidates) {
    const q = await queryGateway(order);
    if (q.outcome === 'paid') {
      const r = await markOrderPaid(order, { gateway: order.paymentMethod.toUpperCase(), gatewayTxnId: q.gatewayTxnId, raw: q.raw, note: q.note });
      if (r === 'applied') report.confirmed += 1;
      else report.skipped += 1;
    } else if (q.outcome === 'error' || q.outcome === 'unknown') {
      // Timeout / no queryable id → NEVER auto-fail; retry next run.
      report.skipped += 1;
      if (q.outcome === 'error') report.errors.push({ order: order.orderNumber, error: q.error });
    } else if (order.createdAt < staleAfter) {
      await markOrderFailed(order, { gateway: order.paymentMethod.toUpperCase(), gatewayTxnId: order.paymentMeta?.trxID || order.paymentMeta?.paymentRefId || order.paymentMeta?.tranId || '', raw: q.raw || {}, status: 'Expired' });
      report.failed += 1;
    } else {
      report.skipped += 1;
    }
  }
  return report;
};

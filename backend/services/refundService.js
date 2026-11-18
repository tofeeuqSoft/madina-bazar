import Return from '../models/Return.js';
import Order from '../models/Order.js';
import * as bkash from '../utils/bkash.js';
import * as sslcommerz from '../utils/sslcommerz.js';

// Gateway refund state machine. Money moves ONLY here:
//   Pending → Processing → Paid | Failed (cron retries) | External (manual)
// COD cash keeps its old behavior (Paid immediately — physical cash, staff-handled).
// Nagad has no e-commerce refund API → External with panel instructions.
// Stable refundRefId per Return keeps gateway retries idempotent on our side.
const MAX_ATTEMPTS = Number(process.env.REFUND_MAX_ATTEMPTS || 5);

const stableRefId = (ret) => ret.refundRefId || `RFD-${ret.returnNumber}`;

const setStatus = async (ret, patch) => {
  Object.assign(ret, patch);
  await ret.save();
};

export const processRefund = async (returnId, { actor = null } = {}) => {
  const ret = typeof returnId === 'object' ? returnId : await Return.findById(returnId);
  if (!ret) throw new Error('Return not found');
  if (ret.refundStatus === 'Paid') return { outcome: 'already-paid', ret };
  if ((ret.refundAmount || 0) <= 0) {
    await setStatus(ret, { refundStatus: 'Paid', note: `${ret.note || ''} [zero-amount auto-closed]`.trim() });
    return { outcome: 'paid-zero', ret };
  }

  const method = (ret.refundMethod || '').toUpperCase();
  if (!ret.refundRefId) ret.refundRefId = stableRefId(ret);
  ret.refundAttempts = (ret.refundAttempts || 0) + 1;

  // Manual channels — no gateway call, staff settles offline.
  if (['CASH', 'BANK', 'OTHER'].includes(method)) {
    await setStatus(ret, {
      refundStatus: method === 'CASH' ? 'Paid' : 'External',
      refundAttempts: ret.refundAttempts,
      note: `${ret.note || ''} [manual ${method} settlement]`.trim(),
    });
    return { outcome: ret.refundStatus === 'Paid' ? 'paid-cash' : 'external', ret };
  }
  if (method === 'NAGAD') {
    await setStatus(ret, {
      refundStatus: 'External', refundAttempts: ret.refundAttempts,
      note: `${ret.note || ''} [refund via Nagad merchant panel — no API]`.trim(),
    });
    return { outcome: 'external', ret };
  }

  await setStatus(ret, { refundStatus: 'Processing', refundAttempts: ret.refundAttempts, refundRefId: ret.refundRefId });
  try {
    if (method === 'BKASH') {
      const order = ret.order ? await Order.findById(ret.order).select('paymentMeta').lean() : null;
      const trxID = order?.paymentMeta?.trxID;
      if (!trxID) throw new Error('Missing bKash trxID on order — cannot refund via API');
      const gw = await bkash.refundPayment({ trxID, amount: ret.refundAmount, reason: ret.reason || 'Order cancelled/returned' });
      await setStatus(ret, { refundStatus: 'Paid', gatewayRefund: gw, nextRetryAt: null });
      return { outcome: 'paid', ret };
    }
    if (method === 'SSLCOMMERZ') {
      const order = ret.order ? await Order.findById(ret.order).select('paymentMeta').lean() : null;
      const bankTranId = order?.paymentMeta?.bankTranId;
      if (!bankTranId) throw new Error('Missing SSLCommerz bankTranId on order — cannot refund via API');
      await sslcommerz.initRefund({ bankTranId, refundAmount: ret.refundAmount, refundRefId: ret.refundRefId, remarks: ret.reason || 'Order cancelled/returned' });
      // Accepted ≠ settled: cron confirms via queryRefundStatus before Paid.
      await setStatus(ret, { refundStatus: 'Processing', gatewayRefund: { initiated: true }, nextRetryAt: new Date(Date.now() + 3600000) });
      return { outcome: 'processing', ret };
    }
    throw new Error(`Unsupported refund method: ${ret.refundMethod}`);
  } catch (e) {
    await setStatus(ret, {
      refundStatus: 'Failed',
      gatewayRefund: { error: e.message },
      nextRetryAt: ret.refundAttempts >= MAX_ATTEMPTS ? null : new Date(Date.now() + 3600000),
    });
    return { outcome: 'failed', error: e.message, ret };
  }
};

// Cron: confirm PROCESSING (SSL query) + retry FAILED (attempts left, due).
export const sweepRefunds = async () => {
  const due = await Return.find({
    refundStatus: { $in: ['Processing', 'Failed'] },
    $or: [{ nextRetryAt: { $lte: new Date() } }, { nextRetryAt: null, refundStatus: 'Failed' }],
  }).limit(50);
  const report = { checked: due.length, paid: 0, failed: 0, external: 0, errors: [] };
  for (const ret of due) {
    try {
      // SSL two-phase confirm: query before re-initiating.
      if ((ret.refundMethod || '').toUpperCase() === 'SSLCOMMERZ' && ret.refundStatus === 'Processing') {
        const order = ret.order ? await Order.findById(ret.order).select('paymentMeta').lean() : null;
        const q = await sslcommerz.queryRefundStatus({ bankTranId: order?.paymentMeta?.bankTranId || '', refundRefId: ret.refundRefId });
        const s = String(q?.status || q?.refund_status || '').toLowerCase();
        if (s.includes('refund') && !s.includes('process') && !s.includes('cancel')) {
          await setStatus(ret, { refundStatus: 'Paid', gatewayRefund: q, nextRetryAt: null });
          report.paid += 1;
          continue;
        }
        if (s.includes('cancel') || s.includes('fail')) {
          await setStatus(ret, { refundStatus: 'Failed', gatewayRefund: q, nextRetryAt: new Date(Date.now() + 3600000) });
          report.failed += 1;
          continue;
        }
        await setStatus(ret, { nextRetryAt: new Date(Date.now() + 3600000) });
        continue;
      }
      if (ret.refundAttempts >= MAX_ATTEMPTS) continue;
      const r = await processRefund(ret, {});
      if (r.outcome === 'paid' || r.outcome === 'paid-zero' || r.outcome === 'paid-cash') report.paid += 1;
      else if (r.outcome === 'external') report.external += 1;
      else report.failed += 1;
    } catch (e) {
      report.errors.push({ return: ret.returnNumber, error: e.message });
    }
  }
  return report;
};

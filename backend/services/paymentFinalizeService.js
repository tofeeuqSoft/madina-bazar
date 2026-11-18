import { claimTxn } from './paymentTxnService.js';
import { recordSale, recordPayment } from './accountingService.js';

// Single place that turns an order Paid/Failed. Every callback, IPN and the
// reconciler MUST go through here — no handler-local copies (drift = bugs).
// Returns 'applied' | 'already-paid' | 'duplicate'. Never throws for
// duplicate/replayed txns; throws only on real DB errors.
export const markOrderPaid = async (order, { gateway, gatewayTxnId, raw = {}, note = '', extraMeta = {} }) => {
  if (order.paymentStatus === 'Paid') {
    await claimTxn({ gateway, gatewayTxnId, order: order._id, orderNumber: order.orderNumber, amount: order.totalAmount, status: 'PAID', raw }).catch(() => {});
    return 'already-paid';
  }
  const { duplicate } = await claimTxn({ gateway, gatewayTxnId, order: order._id, orderNumber: order.orderNumber, amount: order.totalAmount, status: 'PAID', raw });
  if (duplicate) return 'duplicate';

  order.paymentStatus = 'Paid';
  order.paymentMeta = {
    ...(order.paymentMeta || {}),
    transactionStatus: 'Completed',
    paidAt: new Date(),
    raw,
    ...extraMeta,
  };
  if (order.orderStatus === 'Pending') {
    order.orderStatus = 'Confirmed';
    order.statusHistory.push({ status: 'Confirmed', note: note || `Paid via ${gateway}.`, timestamp: new Date() });
  }
  await order.save();
  try {
    await recordSale(order, {});
    const remaining = Math.max(0, (order.totalAmount || 0) - (order.paidAmount || 0));
    if (remaining > 0) {
      await recordPayment(order, { amount: remaining, method: gateway, txnId: gatewayTxnId || '' });
    }
  } catch (e) {
    console.error('[accounting autopilot]', e.message);
  }
  return 'applied';
};

export const markOrderFailed = async (order, { gateway, gatewayTxnId, raw = {}, status = 'Failed' }) => {
  // A Paid order must NEVER be downgraded by a late failure callback.
  if (order.paymentStatus === 'Paid') {
    await claimTxn({ gateway, gatewayTxnId, order: order._id, orderNumber: order.orderNumber, amount: order.totalAmount, status: 'PAID', raw }).catch(() => {});
    return 'already-paid';
  }
  await claimTxn({ gateway, gatewayTxnId, order: order._id, orderNumber: order.orderNumber, amount: order.totalAmount, status: 'FAILED', raw }).catch(() => {});
  order.paymentStatus = 'Failed';
  order.paymentMeta = { ...(order.paymentMeta || {}), transactionStatus: status, raw };
  await order.save();
  return 'applied';
};

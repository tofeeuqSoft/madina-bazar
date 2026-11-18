import PaymentTransaction from '../models/PaymentTransaction.js';

// Atomic gateway-txn claim. Concurrent duplicate callbacks collapse via the
// unique {gateway, gatewayTxnId} index: exactly one winner processes, the
// rest get {duplicate:true} and must NOT re-run history/accounting.
export const claimTxn = async ({ gateway, gatewayTxnId, order = null, orderNumber = '', amount = 0, status = 'INITIATED', raw = {} }) => {
  if (!gateway || !gatewayTxnId) return { txn: null, duplicate: false };
  try {
    const txn = await PaymentTransaction.create({
      gateway, gatewayTxnId, order: order || null, orderNumber, amount, status, raw,
    });
    return { txn, duplicate: false };
  } catch (e) {
    if (e?.code !== 11000) throw e;
    const txn = await PaymentTransaction.findOne({ gateway, gatewayTxnId });
    if (!txn) throw e;
    // A PAID txn is final — late/duplicate callbacks must not replay it.
    if (txn.status === 'PAID') return { txn, duplicate: true };
    txn.status = status;
    if (order && !txn.order) txn.order = order;
    if (orderNumber && !txn.orderNumber) txn.orderNumber = orderNumber;
    if (raw && Object.keys(raw).length) txn.raw = raw;
    await txn.save();
    return { txn, duplicate: false };
  }
};

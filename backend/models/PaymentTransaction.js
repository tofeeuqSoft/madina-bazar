import mongoose from 'mongoose';

// Canonical gateway-transaction index: ONE row per (gateway, gatewayTxnId).
// Purpose: duplicate callbacks/webhooks/retries collapse to the first row —
// no double history, no double accounting, txn mismatch impossible.
// One order may own MANY rows (re-initiate = new gateway txn), but each
// gateway txn maps to exactly one order.
const paymentTransactionSchema = new mongoose.Schema(
  {
    gateway: { type: String, enum: ['BKASH', 'NAGAD', 'SSLCOMMERZ', 'COD', 'OTHER'], required: true },
    gatewayTxnId: { type: String, required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    orderNumber: { type: String, default: '' },
    amount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['INITIATED', 'PAID', 'FAILED', 'CANCELLED'], default: 'INITIATED' },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

paymentTransactionSchema.index({ gateway: 1, gatewayTxnId: 1 }, { unique: true });
paymentTransactionSchema.index({ order: 1, createdAt: -1 });

const PaymentTransaction = mongoose.model('PaymentTransaction', paymentTransactionSchema);
export default PaymentTransaction;

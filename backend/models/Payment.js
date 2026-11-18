import mongoose from 'mongoose';

// Centralized payment records (all methods, incl. manual/partial).
// Gateway math: netReceived = amount - gatewayFee. Never hard-delete.
const paymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, unique: true, required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ['COD', 'BKASH', 'NAGAD', 'SSLCOMMERZ', 'CARD', 'BANK', 'CASH', 'OTHER'],
      default: 'COD',
    },
    transactionId: { type: String, default: '' },
    gatewayFee: { type: Number, default: 0, min: 0 },
    netReceived: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
      default: 'PENDING',
    },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paidAt: Date,
    note: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

paymentSchema.pre('validate', async function (next) {
  if (this.isNew && !this.paymentId) {
    const count = await mongoose.model('Payment').countDocuments();
    this.paymentId = `PAY${Date.now().toString().slice(-8)}${(count + 1).toString().padStart(4, '0')}`;
  }
  if (this.netReceived == null || (this.isNew && !this.netReceived)) {
    this.netReceived = Math.max(0, (this.amount || 0) - (this.gatewayFee || 0));
  }
  next();
});

paymentSchema.index({ order: 1, createdAt: -1 });
paymentSchema.index({ customer: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ paymentMethod: 1, status: 1 });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;

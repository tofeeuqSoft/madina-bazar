import mongoose from 'mongoose';

const returnItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: String,
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
});

const returnSchema = new mongoose.Schema(
  {
    returnNumber: { type: String, unique: true, required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    type: {
      type: String,
      enum: ['SALE_RETURN', 'PURCHASE_RETURN'],
      default: 'SALE_RETURN',
    },
    items: [returnItemSchema],
    refundAmount: { type: Number, required: true, min: 0 },
    reason: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Requested', 'Approved', 'Rejected', 'Refunded'],
      default: 'Requested',
    },
    refundStatus: {
      // Pending → Processing → Paid | Failed (retry) | External (manual: Nagad panel / cash / bank)
      type: String,
      enum: ['Pending', 'Processing', 'Paid', 'Failed', 'External'],
      default: 'Pending',
    },
    refundRefId: { type: String, default: '' },
    gatewayRefund: { type: mongoose.Schema.Types.Mixed, default: {} },
    refundAttempts: { type: Number, default: 0 },
    nextRetryAt: { type: Date, default: null },
    refundMethod: {
      type: String,
      enum: ['Cash', 'BKASH', 'NAGAD', 'SSLCOMMERZ', 'Bank', 'Other'],
      default: 'Cash',
    },
    note: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Accounting link (journal refKey: REFUND:Return:<id>)
    journalPosted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

returnSchema.pre('validate', async function (next) {
  if (this.isNew && !this.returnNumber) {
    const count = await mongoose.model('Return').countDocuments();
    this.returnNumber = `RTN${Date.now().toString().slice(-8)}${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

returnSchema.index({ type: 1, status: 1, createdAt: -1 });
returnSchema.index({ order: 1 });

const Return = mongoose.model('Return', returnSchema);
export default Return;

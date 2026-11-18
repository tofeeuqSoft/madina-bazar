import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Expense title is required'], trim: true },
    category: {
      type: String,
      enum: [
        'Rent',
        'Salary',
        'Utility',
        'Delivery',
        'Marketing',
        'Packaging',
        'Maintenance',
        'Purchase',
        'Refund',
        'Other',
      ],
      default: 'Other',
    },
    amount: { type: Number, required: true, min: 0 },
    expenseDate: { type: Date, default: Date.now },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Bank', 'BKASH', 'NAGAD', 'SSLCOMMERZ', 'Other'],
      default: 'Cash',
    },
    note: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Financial records are never hard-deleted — void instead
    status: {
      type: String,
      enum: ['ACTIVE', 'VOIDED'],
      default: 'ACTIVE',
    },
    voidReason: { type: String, default: '' },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    voidedAt: Date,
  },
  { timestamps: true }
);

expenseSchema.index({ category: 1, expenseDate: -1 });
expenseSchema.index({ expenseDate: -1 });

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;

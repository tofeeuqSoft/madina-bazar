import mongoose from 'mongoose';

const stockAdjustmentSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantKey: { type: String, default: '' },
    sku: { type: String, default: '' },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    quantity: { type: Number, required: true }, // signed delta
    adjustmentType: {
      type: String,
      enum: ['COUNT_CORRECTION', 'DAMAGED', 'LOST', 'FOUND', 'DATA_CORRECTION', 'OTHER'],
      default: 'COUNT_CORRECTION',
    },
    reason: { type: String, required: [true, 'Reason is required'] },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'], default: 'APPROVED' },
    requiresApproval: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

stockAdjustmentSchema.index({ status: 1, createdAt: -1 });
stockAdjustmentSchema.index({ product: 1, warehouse: 1 });

const StockAdjustment = mongoose.model('StockAdjustment', stockAdjustmentSchema);
export default StockAdjustment;

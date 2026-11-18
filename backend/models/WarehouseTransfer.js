import mongoose from 'mongoose';

const transferItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantKey: { type: String, default: '' },
    sku: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const warehouseTransferSchema = new mongoose.Schema(
  {
    transferNo: { type: String, unique: true },
    items: [transferItemSchema],
    fromWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    toWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    status: {
      type: String,
      enum: ['REQUESTED', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'REJECTED', 'CANCELLED'],
      default: 'REQUESTED',
    },
    reason: { type: String, default: '' },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

warehouseTransferSchema.pre('validate', async function (next) {
  if (this.isNew && !this.transferNo) {
    const count = await mongoose.model('WarehouseTransfer').countDocuments();
    this.transferNo = `TRF${Date.now().toString().slice(-8)}${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

warehouseTransferSchema.index({ status: 1, createdAt: -1 });

const WarehouseTransfer = mongoose.model('WarehouseTransfer', warehouseTransferSchema);
export default WarehouseTransfer;

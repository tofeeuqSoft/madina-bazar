import mongoose from 'mongoose';

const inventoryBatchSchema = new mongoose.Schema(
  {
    batchNumber: { type: String, required: true, trim: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, default: '' },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    manufacturingDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    purchaseCost: { type: Number, default: 0, min: 0 },
    quantity: { type: Number, default: 0, min: 0 },
    remainingQuantity: { type: Number, default: 0, min: 0 },
    expiryStatus: { type: String, enum: ['VALID', 'EXPIRING_SOON', 'EXPIRED'], default: 'VALID' },
  },
  { timestamps: true }
);

inventoryBatchSchema.index({ batchNumber: 1, product: 1, warehouse: 1 }, { unique: true });
inventoryBatchSchema.index({ expiryDate: 1 });
inventoryBatchSchema.index({ product: 1, expiryDate: 1 }); // FEFO picking order

const InventoryBatch = mongoose.model('InventoryBatch', inventoryBatchSchema);
export default InventoryBatch;

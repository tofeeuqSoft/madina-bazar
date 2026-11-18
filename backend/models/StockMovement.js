import mongoose from 'mongoose';

// Immutable ledger of every stock change. Never hard-deleted.
// Soft-archive (archived flag) only via the archive endpoint: rows stay in DB
// for audit/restore, operational lists just stop reading them.
const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantKey: { type: String, default: '' },
    sku: { type: String, default: '' },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },

    type: {
      type: String,
      enum: ['PURCHASE', 'SALE', 'RETURN', 'RESTOCK', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGED', 'LOST', 'EXPIRED'],
      required: true,
    },

    quantity: { type: Number, required: true }, // signed delta applied to onHand/bucket
    beforeQuantity: { type: Number, required: true },
    afterQuantity: { type: Number, required: true },

    referenceType: { type: String, default: '' }, // ORDER | PURCHASE | RETURN | TRANSFER | ADJUSTMENT
    referenceId: { type: String, default: '' },
    idempotencyKey: { type: String, default: '' }, // prevents double-deduct (indexed below: unique+sparse)

    reason: { type: String, default: '' },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    performedByType: { type: String, enum: ['HUMAN', 'SYSTEM', 'AI'], default: 'HUMAN' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    archived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stockMovementSchema.index({ archived: 1, createdAt: -1 });
stockMovementSchema.index({ product: 1, warehouse: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1, createdAt: -1 });
stockMovementSchema.index({ referenceType: 1, referenceId: 1 });
stockMovementSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
export default StockMovement;

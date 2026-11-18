import mongoose from 'mongoose';

// Immutable content — no update/delete API touches entry bodies.
// Soft-archive (archived flag) only via the archive endpoint: rows stay in DB,
// live lists stop reading them. The archive run itself is logged as a new
// (recent, live) entry, so the chain never breaks.
const inventoryAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        'STOCK_ADJUSTED', 'STOCK_RESERVED', 'STOCK_RELEASED', 'STOCK_DEDUCTED',
        'STOCK_TRANSFER_CREATED', 'STOCK_TRANSFER_APPROVED', 'STOCK_TRANSFER_RECEIVED',
        'PURCHASE_RECEIVED', 'RETURN_RESTOCKED', 'DAMAGE_RECORDED', 'LOSS_RECORDED',
        'BATCH_CREATED', 'BATCH_UPDATED', 'EXPIRY_UPDATED', 'WAREHOUSE_CREATED',
        'MOVEMENTS_ARCHIVED', 'AUDIT_ARCHIVED', 'INVENTORY_RECONCILED',
      ],
      required: true,
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: '' },
    performedByType: { type: String, enum: ['HUMAN', 'SYSTEM', 'AI'], default: 'HUMAN' },
    entityType: { type: String, default: '' },
    entityId: { type: String, default: '' },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    reason: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

inventoryAuditLogSchema.index({ archived: 1, createdAt: -1 });
inventoryAuditLogSchema.index({ action: 1, createdAt: -1 });
inventoryAuditLogSchema.index({ entityType: 1, entityId: 1 });

const InventoryAuditLog = mongoose.model('InventoryAuditLog', inventoryAuditLogSchema);
export default InventoryAuditLog;

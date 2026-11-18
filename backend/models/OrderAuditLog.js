import mongoose from 'mongoose';

// Immutable audit trail — no update/delete API exposes this model.
const orderAuditLogSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, default: '' },
    action: {
      type: String,
      enum: [
        'ORDER_VIEW',
        'ORDER_STATUS_CHANGED',
        'ORDER_ASSIGNED',
        'ORDER_UNASSIGNED',
        'ORDER_EDITED',
        'ORDER_CANCELLED',
        'ORDER_REOPENED',
        'ORDER_HOLD',
        'ORDER_HOLD_EXPIRED',
        'ORDER_RELEASED',
        'ORDER_ITEM_CANCELLED',
        'ORDER_SUBSTITUTE_PROPOSED',
        'ORDER_PRIORITY_CHANGED',
        'ORDER_NOTE_CREATED',
        'ORDER_COMMUNICATION_SENT',
        'REFUND_REQUESTED',
      ],
      required: true,
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: '' },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    reason: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

orderAuditLogSchema.index({ order: 1, createdAt: -1 });
orderAuditLogSchema.index({ action: 1, createdAt: -1 });

const OrderAuditLog = mongoose.model('OrderAuditLog', orderAuditLogSchema);
export default OrderAuditLog;

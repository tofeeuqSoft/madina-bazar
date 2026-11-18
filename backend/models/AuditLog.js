import mongoose from 'mongoose';

// Who changed what in Delivery Management (zones, areas, charges, rules).
const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    actorName: {
      type: String,
      default: '',
    },
    actorRole: {
      type: String,
      default: '',
    },
    action: {
      type: String,
      required: true,
      // e.g. ZONE_CREATE, ZONE_UPDATE, ZONE_STATUS, ZONE_DELETE,
      // AREA_CREATE, AREA_UPDATE, AREA_STATUS, AREA_DELETE,
      // NATIONWIDE_SAVE, NATIONWIDE_DELETE, FREE_DELIVERY_UPDATE
    },
    entity: {
      type: String,
      default: '', // GroceryZone | DeliveryArea | NationwideCharge | FreeDelivery
    },
    entityId: {
      type: String,
      default: '',
    },
    entityName: {
      type: String,
      default: '',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;

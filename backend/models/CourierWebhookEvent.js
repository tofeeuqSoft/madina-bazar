import mongoose from 'mongoose';

// Stored BEFORE processing so duplicate webhook deliveries are idempotent
// (same provider eventId → single processing) and auditable.
const courierWebhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    eventId: { type: String, required: true },
    shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', default: null },
    trackingNumber: { type: String, default: '' },
    rawStatus: { type: String, default: '' },
    normalizedStatus: { type: String, default: '' },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED'], default: 'RECEIVED' },
    error: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

courierWebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
courierWebhookEventSchema.index({ shipment: 1 });

const CourierWebhookEvent = mongoose.model('CourierWebhookEvent', courierWebhookEventSchema);
export default CourierWebhookEvent;

import mongoose from 'mongoose';

// Admin-controlled courier registry. New providers are DATA rows —
// Order Service never changes when a provider is added.
const courierProviderSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      enum: ['STEADFAST', 'PATHAO', 'CARIBEE', 'PAPERFLY'],
      required: true,
      unique: true,
    },
    name: { type: String, required: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'INACTIVE' },
    priority: { type: Number, default: 10, min: 1 },
    autoShipment: { type: Boolean, default: true },
    codSupported: { type: Boolean, default: true },
    returnSupported: { type: Boolean, default: true },
    trackingSupported: { type: Boolean, default: true },
    cancellationSupported: { type: Boolean, default: true },
    fallbackAllowed: { type: Boolean, default: true },
    maxWeightKg: { type: Number, default: 10, min: 0 },
    // Coverage: empty = nationwide; otherwise district allow-list
    coverageDistricts: [{ type: String }],
    // Provider API paths — completed by admin from the provider's CURRENT
    // official docs (never hard-coded, never guessed). Empty = not configured.
    apiPaths: {
      createShipment: { type: String, default: '' },
      cancelShipment: { type: String, default: '' },
      status: { type: String, default: '' },
      tracking: { type: String, default: '' },
      pickup: { type: String, default: '' },
      return: { type: String, default: '' },
    },
    // Health signals for selection engine (updated by jobs/webhooks)
    successRate: { type: Number, default: 1, min: 0, max: 1 },
    avgDeliveryHours: { type: Number, default: 48, min: 0 },
    consecutiveFailures: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

courierProviderSchema.index({ status: 1, priority: 1 });

const CourierProvider = mongoose.model('CourierProvider', courierProviderSchema);
export default CourierProvider;

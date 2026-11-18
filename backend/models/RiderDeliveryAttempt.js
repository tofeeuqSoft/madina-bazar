import mongoose from 'mongoose';

// Every delivery attempt — success carries proof, failure carries a reason.
const riderDeliveryAttemptSchema = new mongoose.Schema(
  {
    shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', required: true },
    outcome: { type: String, enum: ['DELIVERED', 'FAILED'], required: true },
    failureReason: {
      type: String,
      enum: ['CUSTOMER_UNAVAILABLE', 'WRONG_ADDRESS', 'PHONE_UNREACHABLE', 'CUSTOMER_REFUSED', 'CUSTOMER_REQUESTED_RESCHEDULE', 'RIDER_ISSUE', 'OTHER', ''],
      default: '',
    },
    note: { type: String, default: '' },
    // Proof of delivery
    otpVerified: { type: Boolean, default: false },
    gpsVerified: { type: Boolean, default: false },
    gpsDistanceM: { type: Number, default: null },
    photo: { type: String, default: '' },
    signature: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

riderDeliveryAttemptSchema.index({ shipment: 1, createdAt: -1 });
riderDeliveryAttemptSchema.index({ rider: 1, createdAt: -1 });

const RiderDeliveryAttempt = mongoose.model('RiderDeliveryAttempt', riderDeliveryAttemptSchema);
export default RiderDeliveryAttempt;

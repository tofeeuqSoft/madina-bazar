import mongoose from 'mongoose';

// Every grocery eligibility check (hit or miss) — powers
// "which area has most unavailable" analytics. Auto-expires (TTL 90 days).
const deliveryCheckLogSchema = new mongoose.Schema(
  {
    available: {
      type: Boolean,
      required: true,
    },
    matchMethod: {
      type: String,
      default: '', // barikoi-id | geo | none
    },
    zoneName: {
      type: String,
      default: '',
    },
    // Rounded grid (~1km) for hotspot grouping — not exact customer pins
    gridLat: Number,
    gridLng: Number,
    placeId: {
      type: String,
      default: '',
    },
    addressHint: {
      type: String,
      default: '',
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 90 * 24 * 60 * 60, // 90 days
    },
  },
  { timestamps: false }
);

deliveryCheckLogSchema.index({ available: 1, createdAt: -1 });
deliveryCheckLogSchema.index({ gridLat: 1, gridLng: 1 });

const DeliveryCheckLog = mongoose.model('DeliveryCheckLog', deliveryCheckLogSchema);
export default DeliveryCheckLog;

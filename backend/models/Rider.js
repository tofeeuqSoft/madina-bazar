import mongoose from 'mongoose';

// Own-rider profile. Auth/credentials stay on User (DELIVERY_RIDER role) —
// this model holds ONLY operational delivery data (no passwords, no secrets).
const riderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    isAvailable: { type: Boolean, default: true },
    // Operational presence (mirrors isAvailable; ACTIVE + AVAILABLE = assignable)
    riderStatus: {
      type: String,
      enum: ['AVAILABLE', 'BUSY', 'ON_DELIVERY', 'OFFLINE', 'BREAK', 'SUSPENDED'],
      default: 'AVAILABLE',
    },
    employmentStatus: {
      type: String,
      enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT'],
      default: 'FULL_TIME',
    },
    photo: { type: String, default: '' },
    joiningDate: { type: Date, default: Date.now },
    assignedZones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GroceryZone' }],
    maxDailyOrders: { type: Number, default: 30, min: 1 },
    maxActiveOrders: { type: Number, default: 5, min: 1 },
    currentAssignedOrders: { type: Number, default: 0, min: 0 },
    currentActiveOrders: { type: Number, default: 0, min: 0 },
    vehicleType: { type: String, enum: ['BICYCLE', 'MOTORBIKE', 'VAN', 'OTHER'], default: 'MOTORBIKE' },
    // Live location — updated by rider app only during active shift/delivery
    currentLocation: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] }, // [lng, lat]
      updatedAt: { type: Date, default: null },
    },
    activeShift: { type: mongoose.Schema.Types.ObjectId, ref: 'RiderShift', default: null },
    // Lifetime performance (updated by shipment events, read by reports)
    totalDelivered: { type: Number, default: 0, min: 0 },
    totalFailed: { type: Number, default: 0, min: 0 },
    totalCodCollected: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

riderSchema.index({ status: 1, isAvailable: 1 });
riderSchema.index({ riderStatus: 1, isAvailable: 1 });
riderSchema.index({ assignedZones: 1 });
riderSchema.index({ currentLocation: '2dsphere' });

const Rider = mongoose.model('Rider', riderSchema);
export default Rider;

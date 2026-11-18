import mongoose from 'mongoose';

// Rider ↔ zone link with operational window (replaces ad-hoc arrays for planning).
const riderZoneAssignmentSchema = new mongoose.Schema(
  {
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', required: true },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'GroceryZone', required: true },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 1, min: 1 },
    maxDailyOrders: { type: Number, default: 30, min: 1 },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: { type: Date, default: null },
  },
  { timestamps: true }
);

riderZoneAssignmentSchema.index({ rider: 1, zone: 1 }, { unique: true });
riderZoneAssignmentSchema.index({ zone: 1, isActive: 1 });

const RiderZoneAssignment = mongoose.model('RiderZoneAssignment', riderZoneAssignmentSchema);
export default RiderZoneAssignment;

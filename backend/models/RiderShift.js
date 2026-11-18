import mongoose from 'mongoose';

// Shift template, e.g. Morning 09:00-17:00. Auto-assignment only fires when
// the rider's shift is active AND riderStatus is AVAILABLE.
const riderShiftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // Morning Shift
    startHour: { type: Number, required: true, min: 0, max: 23 },
    endHour: { type: Number, required: true, min: 1, max: 24 },
    zones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GroceryZone' }], // empty = all zones
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const shiftActiveNow = (shift, at = new Date()) => {
  if (!shift || !shift.isActive) return false;
  const h = at.getHours() + at.getMinutes() / 60;
  if (shift.startHour <= shift.endHour) return h >= shift.startHour && h < shift.endHour;
  return h >= shift.startHour || h < shift.endHour; // overnight
};

const RiderShift = mongoose.model('RiderShift', riderShiftSchema);
export default RiderShift;

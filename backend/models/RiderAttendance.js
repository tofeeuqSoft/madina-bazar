import mongoose from 'mongoose';

const riderAttendanceSchema = new mongoose.Schema(
  {
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD (local)
    status: { type: String, enum: ['PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'HALF_DAY'], default: 'PRESENT' },
    clockIn: { type: Date, default: null },
    clockOut: { type: Date, default: null },
    shift: { type: mongoose.Schema.Types.ObjectId, ref: 'RiderShift', default: null },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'GroceryZone', default: null },
    deliveryCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

riderAttendanceSchema.index({ rider: 1, date: 1 }, { unique: true });

const RiderAttendance = mongoose.model('RiderAttendance', riderAttendanceSchema);
export default RiderAttendance;

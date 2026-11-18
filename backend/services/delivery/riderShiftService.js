import Rider from '../../models/Rider.js';
import RiderShift from '../../models/RiderShift.js';
import RiderAttendance from '../../models/RiderAttendance.js';
import { shiftActiveNow } from '../../models/RiderShift.js';
import { logAudit } from '../../utils/auditLog.js';

const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Rider starts shift: attendance clock-in + presence AVAILABLE.
export const startShift = async ({ riderId, shiftId = null, zoneId = null, actor = null, req = null }) => {
  const rider = await Rider.findById(riderId);
  if (!rider) {
    const e = new Error('Rider not found');
    e.statusCode = 404;
    throw e;
  }
  const key = todayKey();
  const attendance = await RiderAttendance.findOneAndUpdate(
    { rider: riderId, date: key },
    { $setOnInsert: { status: 'PRESENT' }, $set: { clockIn: new Date(), shift: shiftId, zone: zoneId } },
    { new: true, upsert: true }
  );
  rider.activeShift = shiftId;
  rider.riderStatus = 'AVAILABLE';
  rider.isAvailable = true;
  await rider.save();
  try {
    logAudit(req, { action: 'SHIFT_START', entity: 'RiderAttendance', entityId: attendance._id, details: { riderId } });
  } catch (_) {}
  return { rider, attendance };
};

export const endShift = async ({ riderId, actor = null, req = null }) => {
  const rider = await Rider.findById(riderId);
  if (!rider) {
    const e = new Error('Rider not found');
    e.statusCode = 404;
    throw e;
  }
  const attendance = await RiderAttendance.findOneAndUpdate(
    { rider: riderId, date: todayKey() },
    { $set: { clockOut: new Date() } },
    { new: true }
  );
  rider.activeShift = null;
  rider.riderStatus = 'OFFLINE';
  rider.isAvailable = false;
  await rider.save();
  try {
    logAudit(req, { action: 'SHIFT_END', entity: 'RiderAttendance', entityId: attendance?._id, details: { riderId } });
  } catch (_) {}
  return { rider, attendance };
};

export const updatePresence = async ({ riderId, riderStatus, isAvailable }) => {
  const rider = await Rider.findById(riderId);
  if (!rider) {
    const e = new Error('Rider not found');
    e.statusCode = 404;
    throw e;
  }
  if (riderStatus) {
    if (!['AVAILABLE', 'BUSY', 'ON_DELIVERY', 'OFFLINE', 'BREAK', 'SUSPENDED'].includes(riderStatus)) {
      const e = new Error('Invalid rider status');
      e.statusCode = 400;
      throw e;
    }
    rider.riderStatus = riderStatus;
    rider.isAvailable = riderStatus === 'AVAILABLE';
  }
  if (typeof isAvailable === 'boolean') rider.isAvailable = isAvailable;
  await rider.save();
  return rider;
};

export const updateLocation = async ({ riderId, lng, lat }) => {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    const e = new Error('Valid lng/lat required');
    e.statusCode = 400;
    throw e;
  }
  return Rider.findByIdAndUpdate(
    riderId,
    { $set: { currentLocation: { type: 'Point', coordinates: [lng, lat], updatedAt: new Date() } } },
    { new: true }
  );
};

export { shiftActiveNow };

import Rider from '../../models/Rider.js';
import RiderZoneAssignment from '../../models/RiderZoneAssignment.js';
import Shipment from '../../models/Shipment.js';
import Settings from '../../models/Settings.js';
import { shiftActiveNow } from '../../models/RiderShift.js';
import { scoreRider, DEFAULT_SCORE_WEIGHTS } from './deliveryLogic.js';
import { logAudit } from '../../utils/auditLog.js';

const activeLoad = (riderId) =>
  Shipment.countDocuments({ rider: riderId, status: { $in: ['ASSIGNED', 'ACCEPTED', 'PENDING_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY'] } });

// Haversine km between rider GPS and order address (null when unknown)
const distanceKm = (rider, order) => {
  const rc = rider.currentLocation?.coordinates;
  const lat = order?.shippingAddress?.latitude;
  const lng = order?.shippingAddress?.longitude;
  if (!rc || rc.length !== 2 || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const [lng1, lat1] = rc;
  const R = 6371;
  const dLat = ((lat - lat1) * Math.PI) / 180;
  const dLng = ((lng - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

// Automatic scored assignment: zone → availability → shift → capacity → score.
export const autoAssignRider = async ({ shipment, order, zoneId, actor = null, req = null }) => {
  const settings = (await Settings.findOne()) || {};
  const weights = settings.riderScoreWeights || DEFAULT_SCORE_WEIGHTS;

  const assignments = await RiderZoneAssignment.find({ zone: zoneId, isActive: true }).populate({
    path: 'rider',
    match: { status: 'ACTIVE', isAvailable: true },
    populate: [{ path: 'user', select: 'name' }, { path: 'activeShift' }],
  });
  // Fallback: riders carrying the zone on legacy assignedZones
  let candidates = assignments.map((a) => a.rider).filter(Boolean);
  if (!candidates.length) {
    candidates = await Rider.find({ status: 'ACTIVE', isAvailable: true, assignedZones: zoneId })
      .populate('user', 'name')
      .populate('activeShift');
  }

  let best = null;
  let bestScore = -1;
  for (const r of candidates) {
    if (['SUSPENDED', 'OFFLINE', 'BREAK'].includes(r.riderStatus)) continue;
    const shiftOk = !r.activeShift || shiftActiveNow(r.activeShift);
    if (!shiftOk) continue;
    const load = await activeLoad(r._id);
    if (load >= (r.maxActiveOrders || 5)) continue;
    const dist = distanceKm(r, order);
    const total = r.totalDelivered + r.totalFailed;
    const success = total ? r.totalDelivered / total : 1;
    const score = scoreRider({
      zoneMatch: 1,
      distanceKm: dist ?? 10,
      remainingCapacity: (r.maxDailyOrders || 30) - load,
      maxCapacity: r.maxDailyOrders || 30,
      activeOrders: load,
      maxActive: r.maxActiveOrders || 5,
      successRate: success,
      shiftActive: shiftOk,
      weights,
    });
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }

  if (!best) return { rider: null, score: -1 };
  shipment.rider = best._id;
  shipment.status = 'ASSIGNED';
  shipment.statusHistory.push({ status: 'ASSIGNED', changedBy: actor?._id || null, note: `Auto-assigned (score ${bestScore.toFixed(2)})` });
  await shipment.save();
  try {
    logAudit(req, { action: 'RIDER_ASSIGNED', entity: 'Shipment', entityId: shipment._id, entityName: shipment.shipmentNo, details: { rider: best._id, score: bestScore } });
  } catch (_) {}
  return { rider: best, score: bestScore };
};

export const assignZone = async ({ riderId, zoneId, priority = 1, maxDailyOrders = 30, actor = null, req = null }) => {
  const link = await RiderZoneAssignment.findOneAndUpdate(
    { rider: riderId, zone: zoneId },
    { $set: { isActive: true, priority, maxDailyOrders, effectiveFrom: new Date(), effectiveTo: null } },
    { new: true, upsert: true }
  );
  await Rider.findByIdAndUpdate(riderId, { $addToSet: { assignedZones: zoneId } });
  try {
    logAudit(req, { action: 'RIDER_ZONE_ASSIGNED', entity: 'RiderZoneAssignment', entityId: link._id, details: { riderId, zoneId } });
  } catch (_) {}
  return link;
};

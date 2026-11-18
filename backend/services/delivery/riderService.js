import Rider from '../../models/Rider.js';
import Shipment from '../../models/Shipment.js';
import User from '../../models/User.js';
import { logAudit } from '../../utils/auditLog.js';

const dayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getAvailableRiders = async ({ zoneId = null } = {}) => {
  const q = { status: 'ACTIVE', isAvailable: true };
  if (zoneId) q.assignedZones = zoneId;
  return Rider.find(q).populate('user', 'name phone').sort({ currentAssignedOrders: 1 });
};

export const riderLoadToday = async (riderId) =>
  Shipment.countDocuments({
    rider: riderId,
    deliveryMode: 'OWN_DELIVERY',
    status: { $nin: ['DELIVERED', 'CANCELLED', 'FAILED', 'RETURNED'] },
  });

// Least-loaded rider in zone with remaining daily capacity
export const pickRider = async ({ zoneId }) => {
  const riders = await getAvailableRiders({ zoneId });
  for (const r of riders) {
    const load = await riderLoadToday(r._id);
    if (load < (r.maxDailyOrders || 30)) return { rider: r, load };
  }
  return { rider: null, load: 0 };
};

export const createRider = async ({ userId, vehicleType, maxDailyOrders, assignedZones, actor, req }) => {
  const user = await User.findById(userId);
  if (!user) {
    const e = new Error('User not found');
    e.statusCode = 404;
    throw e;
  }
  if (user.role !== 'DELIVERY_RIDER') {
    user.role = 'DELIVERY_RIDER';
    await user.save();
  }
  const rider = await Rider.create({ user: userId, vehicleType, maxDailyOrders, assignedZones });
  try {
    logAudit(req, { action: 'RIDER_CREATE', entity: 'Rider', entityId: rider._id, entityName: user.name });
  } catch (_) {}
  return rider;
};

export const riderCapacityToday = async ({ zoneId }) => {
  const riders = await getAvailableRiders({ zoneId });
  let capacity = 0;
  let assigned = 0;
  for (const r of riders) {
    capacity += r.maxDailyOrders || 0;
    assigned += await riderLoadToday(r._id);
  }
  return { riders: riders.length, capacity, assigned, remaining: Math.max(0, capacity - assigned) };
};

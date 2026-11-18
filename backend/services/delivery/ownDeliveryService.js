import Shipment from '../../models/Shipment.js';
import Rider from '../../models/Rider.js';
import Settings from '../../models/Settings.js';
import { pickRider, riderLoadToday } from './riderService.js';
import { capacityDecision } from './deliveryLogic.js';
import { transitionShipment } from './shipmentService.js';
import { logAudit } from '../../utils/auditLog.js';

export const createDelivery = async ({ shipment, coverage, actor = null, req = null }) => {
  // Scored auto-assignment (zone → shift → capacity → score); falls back to
  // least-load pick when no zone-scored candidate exists.
  const Order = (await import('../../models/Order.js')).default;
  const order = await Order.findById(shipment.order);
  const { autoAssignRider } = await import('./riderAssignmentService.js');
  let scored = { rider: null, score: -1 };
  try {
    scored = await autoAssignRider({ shipment, order, zoneId: coverage.zoneId, actor, req });
  } catch (e) {
    console.error('[rider scoring]', e.message);
  }
  if (scored.rider) {
    const Rider = (await import('../../models/Rider.js')).default;
    const r = await Rider.findById(scored.rider._id || scored.rider);
    if (r) {
      r.currentAssignedOrders = await riderLoadToday(r._id);
      await r.save();
    }
    return { shipment, assigned: true, rider: scored.rider };
  }
  const { rider } = await pickRider({ zoneId: coverage.zoneId });
  const settings = (await Settings.findOne()) || {};
  const policy = settings.capacityFullPolicy || 'ADMIN_REVIEW';

  if (!rider) {
    const decision = capacityDecision({ zoneOrdersToday: Infinity, riderCapacity: 0, policy });
    shipment.lastError = `No available rider — policy: ${decision.action}`;
    await shipment.save();
    try {
      logAudit(req, { action: 'RIDER_CAPACITY_FULL', entity: 'Shipment', entityId: shipment._id, entityName: shipment.shipmentNo, details: { policy: decision.action } });
    } catch (_) {}
    return { shipment, assigned: false, fallbackPolicy: decision.action };
  }

  shipment.rider = rider._id;
  shipment.status = 'ASSIGNED';
  shipment.statusHistory.push({ status: 'ASSIGNED', changedBy: actor?._id || null, note: `Auto-assigned to rider` });
  await shipment.save();
  rider.currentAssignedOrders = await riderLoadToday(rider._id);
  await rider.save();
  try {
    logAudit(req, { action: 'RIDER_ASSIGNED', entity: 'Shipment', entityId: shipment._id, entityName: shipment.shipmentNo, details: { rider: rider._id } });
  } catch (_) {}
  return { shipment, assigned: true, rider };
};

export const assignRider = async ({ shipment, riderId, actor = null, req = null }) => {
  const rider = await Rider.findById(riderId).populate('user', 'name phone');
  if (!rider || rider.status !== 'ACTIVE') {
    const e = new Error('Rider not available');
    e.statusCode = 400;
    throw e;
  }
  const load = await riderLoadToday(rider._id);
  if (load >= (rider.maxDailyOrders || 30)) {
    const e = new Error('Rider at full capacity');
    e.statusCode = 400;
    e.code = 'RIDER_CAPACITY_FULL';
    throw e;
  }
  shipment.rider = rider._id;
  await transitionShipment({ shipment, status: 'ASSIGNED', actor, note: 'Manually assigned', req });
  rider.currentAssignedOrders = await riderLoadToday(rider._id);
  await rider.save();
  return shipment;
};

export const reassignRider = async ({ shipment, riderId, actor = null, reason = '', req = null }) => {
  const prev = shipment.rider;
  await assignRider({ shipment, riderId, actor, req });
  try {
    logAudit(req, { action: 'RIDER_REASSIGNED', entity: 'Shipment', entityId: shipment._id, entityName: shipment.shipmentNo, details: { from: prev, to: riderId, reason } });
  } catch (_) {}
  return shipment;
};

export const acceptDelivery = async ({ shipment, actor = null, req = null }) => {
  if (actor && shipment.rider) {
    const Rider = (await import('../../models/Rider.js')).default;
    const me = await Rider.findOne({ user: actor._id || actor });
    if (me && String(me._id) !== String(shipment.rider)) {
      const e = new Error('Shipment assigned to another rider');
      e.statusCode = 403;
      throw e;
    }
  }
  const rider = shipment.rider ? await (await import('../../models/Rider.js')).default.findById(shipment.rider) : null;
  if (rider) {
    rider.riderStatus = 'ON_DELIVERY';
    await rider.save();
  }
  return transitionShipment({ shipment, status: 'ACCEPTED', actor, note: 'Accepted by rider', req });
};

export const markPickedUp = (ctx) => transitionShipment({ ...ctx, status: 'PICKED_UP' });

export const markOutForDelivery = async ({ shipment, actor = null, req = null, note = '' }) => {
  await transitionShipment({ shipment, status: 'OUT_FOR_DELIVERY', actor, note: note || 'Out for delivery', req });
  // Issue customer OTP (proof-of-delivery) — sent via notification channel
  const { issueOtp } = await import('./proofService.js');
  const otp = await issueOtp(shipment);
  try {
    const { notifyDeliveryOtp } = await import('../../utils/notifications.js');
    const Order = (await import('../../models/Order.js')).default;
    const order = await Order.findById(shipment.order).populate('customer', 'name phone email');
    if (order?.customer) await notifyDeliveryOtp(order, order.customer, otp).catch(() => {});
  } catch (_) {}
  return shipment;
};

export const markDelivered = async ({ shipment, actor = null, collectedAmount = 0, req = null, otp = '', riderLng = null, riderLat = null, photo = '', signature = '' }) => {
  const Order = (await import('../../models/Order.js')).default;
  const Rider = (await import('../../models/Rider.js')).default;
  const Shipment = (await import('../../models/Shipment.js')).default;
  const withOrder = await Shipment.findById(shipment._id).populate('order');
  const { verifyPod, recordAttempt } = await import('./proofService.js');
  // A rider can never mark delivered without passing proof validation
  const proof = await verifyPod({ shipment: withOrder, otp, riderLng, riderLat, photo, signature });
  const fresh = await Shipment.findById(shipment._id);
  await transitionShipment({ shipment: fresh, status: 'DELIVERED', actor, note: `Delivered (OTP✓${proof.gpsVerified ? ' GPS✓' : ''})`, req });
  if (fresh.codAmount > 0) {
    fresh.collectedAmount = collectedAmount || fresh.codAmount;
    await fresh.save();
    // COD handover record — variance auto-flagged for review
    const RiderCODCollection = (await import('../../models/RiderCODCollection.js')).default;
    await RiderCODCollection.findOneAndUpdate(
      { shipment: fresh._id },
      {
        $setOnInsert: { order: fresh.order, rider: fresh.rider, expectedAmount: fresh.codAmount },
        $set: { collectedAmount: fresh.collectedAmount, submittedAmount: 0, status: 'PENDING' },
      },
      { upsert: true, new: true }
    );
  }
  const orderDoc = await Order.findById(fresh.order);
  if (fresh.rider) {
    await recordAttempt({ shipment: fresh, order: orderDoc || fresh.order, rider: fresh.rider, outcome: 'DELIVERED', proof });
  }
  const rider = fresh.rider ? await Rider.findById(fresh.rider) : null;
  if (rider) {
    rider.totalDelivered += 1;
    rider.totalCodCollected += fresh.collectedAmount || 0;
    rider.currentAssignedOrders = await riderLoadToday(rider._id);
    await rider.save();
  }
  try {
    if (orderDoc && !['Delivered', 'DELIVERED'].includes(orderDoc.orderStatus)) {
      orderDoc.orderStatus = orderDoc.deliveryMode === 'OWN_DELIVERY' ? 'Delivered' : orderDoc.orderStatus;
      orderDoc.deliveryStatus = 'Delivered';
      if (!orderDoc.trackingId) orderDoc.trackingId = fresh.trackingNumber || fresh.shipmentNo;
      await orderDoc.save({ validateBeforeSave: false });
    }
  } catch (_) {}
  return fresh;
};

const FAILURE_REASONS = ['CUSTOMER_UNAVAILABLE', 'WRONG_ADDRESS', 'PHONE_UNREACHABLE', 'CUSTOMER_REFUSED', 'CUSTOMER_REQUESTED_RESCHEDULE', 'RIDER_ISSUE', 'OTHER'];

export const markFailed = async ({ shipment, actor = null, note = '', reason = 'OTHER', req = null }) => {
  if (!FAILURE_REASONS.includes(reason)) {
    const e = new Error('Valid failure reason is required');
    e.statusCode = 400;
    e.code = 'DELIVERY_FAILURE_REASON';
    throw e;
  }
  await transitionShipment({ shipment, status: 'FAILED', actor, note: note || `Failed: ${reason}`, req });
  shipment.failedAt = new Date();
  await shipment.save().catch(() => {});
  const Rider = (await import('../../models/Rider.js')).default;
  const rider = shipment.rider ? await Rider.findById(shipment.rider) : null;
  if (rider) {
    rider.totalFailed += 1;
    rider.currentAssignedOrders = await riderLoadToday(rider._id);
    await rider.save();
    const Order = (await import('../../models/Order.js')).default;
    const orderDoc = await Order.findById(shipment.order);
    const { recordAttempt } = await import('./proofService.js');
    await recordAttempt({ shipment, order: orderDoc || shipment.order, rider: rider._id, outcome: 'FAILED', failureReason: reason, note });
  }
  return shipment;
};

export const collectCOD = async ({ shipment, amount, actor = null, req = null }) => {
  shipment.collectedAmount = (shipment.collectedAmount || 0) + Number(amount || 0);
  await shipment.save();
  try {
    logAudit(req, { action: 'COD_COLLECTED', entity: 'Shipment', entityId: shipment._id, entityName: shipment.shipmentNo, details: { amount } });
  } catch (_) {}
  return shipment;
};

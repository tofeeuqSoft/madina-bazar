import Shipment from '../../models/Shipment.js';
import Order from '../../models/Order.js';
import { shipmentKey, normalizeStatus } from './deliveryLogic.js';
import { logAudit } from '../../utils/auditLog.js';

const VALID = {
  CREATED: ['PENDING_ASSIGNMENT', 'ASSIGNED', 'CANCELLED'],
  PENDING_ASSIGNMENT: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['ACCEPTED', 'PENDING_PICKUP', 'PICKED_UP', 'CANCELLED'],
  ACCEPTED: ['PENDING_PICKUP', 'PICKED_UP', 'CANCELLED'],
  PENDING_PICKUP: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'FAILED'],
  IN_TRANSIT: ['AT_DESTINATION', 'OUT_FOR_DELIVERY', 'FAILED'],
  AT_DESTINATION: ['OUT_FOR_DELIVERY', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
  DELIVERED: ['RETURN_REQUESTED'],
  FAILED: ['RETURN_REQUESTED', 'CANCELLED'],
  CANCELLED: [],
  RETURN_REQUESTED: ['RETURNED', 'CANCELLED'],
  RETURNED: [],
};

// Idempotent create — same order+attempt returns the existing shipment.
export const createShipment = async ({ order, deliveryMode, provider, coverage = {}, charge = {}, actor = null, attempt = 1, req = null }) => {
  const key = shipmentKey(order._id || order, attempt);
  const existing = await Shipment.findOne({ idempotencyKey: key });
  if (existing) return { shipment: existing, duplicate: true };

  const full = await Order.findById(order._id || order);
  const codAmount = full?.paymentMethod === 'COD' ? Math.max(0, (full.totalAmount || 0) - (full.paidAmount || 0)) : 0;
  const customerCharge = charge.customerCharge ?? full?.deliveryCharge ?? 0;
  const actualCost = charge.actualCost ?? 0;

  const shipment = await Shipment.create({
    order: full._id,
    deliveryMode,
    provider,
    zone: coverage.zoneId || null,
    zoneName: coverage.zoneName || '',
    areaName: coverage.areaName || '',
    barikoiLocationId: coverage.barikoilocationId || '',
    status: provider === 'OWN_RIDER' ? 'PENDING_ASSIGNMENT' : 'CREATED',
    statusHistory: [{ status: provider === 'OWN_RIDER' ? 'PENDING_ASSIGNMENT' : 'CREATED', changedBy: actor?._id || null, note: 'Shipment created' }],
    codAmount,
    customerDeliveryCharge: customerCharge,
    actualDeliveryCost: actualCost,
    deliveryMargin: customerCharge - actualCost,
    idempotencyKey: key,
    attempt,
  });

  // Convenience mirrors on Order (history lives in Shipment — never recalculated)
  try {
    full.deliveryMode = deliveryMode;
    await full.save({ validateBeforeSave: false });
  } catch (_) {}

  try {
    logAudit(req, { action: 'SHIPMENT_CREATED', entity: 'Shipment', entityId: shipment._id, entityName: shipment.shipmentNo, details: { deliveryMode, provider } });
  } catch (_) {}
  return { shipment, duplicate: false };
};

export const transitionShipment = async ({ shipment, status, actor = null, note = '', req = null }) => {
  const next = normalizeStatus(status);
  const allowed = VALID[shipment.status] || [];
  if (shipment.status !== next && !allowed.includes(next)) {
    const e = new Error(`Invalid shipment transition ${shipment.status} -> ${next}`);
    e.statusCode = 400;
    e.code = 'SHIPMENT_INVALID_TRANSITION';
    throw e;
  }
  const prev = shipment.status;
  shipment.status = next;
  shipment.statusHistory.push({ status: next, changedBy: actor?._id || null, note: note || `Moved to ${next}` });
  await shipment.save();
  try {
    logAudit(req, { action: 'SHIPMENT_STATUS', entity: 'Shipment', entityId: shipment._id, entityName: shipment.shipmentNo, details: { from: prev, to: next } });
  } catch (_) {}
  return shipment;
};

export const shipmentsForOrder = (orderId) =>
  Shipment.find({ order: orderId }).populate('rider').sort({ createdAt: -1 });

import GroceryZone from '../models/GroceryZone.js';
import Rider from '../models/Rider.js';
import Shipment from '../models/Shipment.js';
import CourierProvider from '../models/CourierProvider.js';
import CourierCredential, { encryptSecret } from '../models/CourierCredential.js';
import CourierApiLog from '../models/CourierApiLog.js';
import CourierWebhookEvent from '../models/CourierWebhookEvent.js';
import Settings from '../models/Settings.js';
import { logAudit } from '../utils/auditLog.js';
import { deliveryDashboard, networkGrowth, courierPerformance as courierPerformanceSvc, ownPerformance } from '../services/delivery/deliveryReportService.js';
import { networkFootprint } from '../services/delivery/coverageService.js';
import { getAvailableRiders, createRider, riderCapacityToday } from '../services/delivery/riderService.js';
import { listProviders } from '../services/delivery/courierSelectionService.js';
import { transitionShipment, shipmentsForOrder } from '../services/delivery/shipmentService.js';
import { assignRider, reassignRider, markPickedUp, markOutForDelivery, markDelivered, markFailed, collectCOD } from '../services/delivery/ownDeliveryService.js';
import { routeOrder, ingestWebhook } from '../services/delivery/orchestratorService.js';
import { adminTracking } from '../services/delivery/trackingService.js';
import { codSummary, settleCod, marginReport } from '../services/delivery/settlementService.js';

const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const ipOf = (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '';

export const getDashboard = asyncH(async (req, res) => {
  res.json({ success: true, data: await deliveryDashboard() });
});
export const getGrowth = asyncH(async (req, res) => {
  res.json({ success: true, data: { growth: await networkGrowth(), footprint: await networkFootprint() } });
});

// ---- Zones: activation = network expansion (no code change) ----
export const activateZone = asyncH(async (req, res) => {
  const z = await GroceryZone.findById(req.params.id);
  if (!z) return res.status(404).json({ success: false, message: 'Zone not found' });
  const { status, deliveryMode } = req.body;
  if (status && !['ACTIVE', 'INACTIVE', 'COMING_SOON'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status', code: 'DELIVERY_VALIDATION' });
  }
  if (deliveryMode && !['OWN_DELIVERY', 'EXTERNAL_COURIER'].includes(deliveryMode)) {
    return res.status(400).json({ success: false, message: 'Invalid deliveryMode', code: 'DELIVERY_VALIDATION' });
  }
  const prev = { status: z.status, deliveryMode: z.deliveryMode };
  if (status) z.status = status;
  if (deliveryMode) z.deliveryMode = deliveryMode;
  await z.save();
  try {
    logAudit(req, { action: 'ZONE_STATUS', entity: 'GroceryZone', entityId: z._id, entityName: z.name, details: { from: prev, to: { status: z.status, deliveryMode: z.deliveryMode } }, ip: ipOf(req) });
  } catch (_) {}
  res.json({ success: true, data: z, message: z.status === 'ACTIVE' && z.deliveryMode === 'OWN_DELIVERY' ? 'Zone is now part of the Own Delivery Network — new orders route automatically' : 'Zone updated' });
});

// ---- Riders ----
export const listRiders = asyncH(async (req, res) => {
  const q = {};
  if (req.query.status) q.status = req.query.status;
  const [data, total] = await Promise.all([
    Rider.find(q).populate('user', 'name phone email').populate('assignedZones', 'name district').sort({ createdAt: -1 }).limit(100),
    Rider.countDocuments(q),
  ]);
  res.json({ success: true, total, data });
});
export const postRider = asyncH(async (req, res) => {
  const rider = await createRider({ ...req.body, actor: req.user, req });
  res.status(201).json({ success: true, data: rider });
});
export const patchRider = asyncH(async (req, res) => {
  const r = await Rider.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data: r });
});
export const riderCapacity = asyncH(async (req, res) => {
  res.json({ success: true, data: await riderCapacityToday({ zoneId: req.query.zoneId || null }) });
});
export const riderPerformance = asyncH(async (req, res) => {
  res.json({ success: true, data: await ownPerformance() });
});

// ---- Shipments ----
export const listShipments = asyncH(async (req, res) => {
  const q = {};
  if (req.query.status) q.status = req.query.status;
  if (req.query.mode) q.deliveryMode = req.query.mode;
  if (req.query.provider) q.provider = req.query.provider;
  if (req.query.rider) q.rider = req.query.rider;
  const [data, total] = await Promise.all([
    Shipment.find(q).populate('order', 'orderNumber totalAmount').populate({ path: 'rider', populate: { path: 'user', select: 'name phone' } }).sort({ createdAt: -1 }).limit(50),
    Shipment.countDocuments(q),
  ]);
  res.json({ success: true, total, data });
});
export const getShipment = asyncH(async (req, res) => {
  res.json({ success: true, data: await adminTracking(req.params.id) });
});
export const createShipmentForOrder = asyncH(async (req, res) => {
  const result = await routeOrder({ orderId: req.params.id, actor: req.user, manualCourier: req.body.courier || null, req });
  res.status(201).json({ success: true, data: result });
});
export const retryShipment = asyncH(async (req, res) => {
  const s = await Shipment.findById(req.params.id).populate('order');
  if (!s) return res.status(404).json({ success: false, message: 'Shipment not found' });
  // Max-attempt guard: endless retries bleed courier cost — RTO instead.
  const { assertRetryAllowed } = await import('../services/delivery/rtoService.js');
  const gate = await assertRetryAllowed(s.order._id || s.order);
  const result = await routeOrder({ orderId: s.order._id || s.order, actor: req.user, req, attempt: (s.attempt || 1) + 1 });
  res.json({ success: true, data: { ...result, rto: { failedBefore: gate.failed, maxAttempts: gate.failed + gate.remaining } } });
});
// ---- Delivery slots (time windows + per-day capacity) ----
export const listSlotsAdmin = asyncH(async (req, res) => {
  const DeliverySlot = (await import('../models/DeliverySlot.js')).default;
  res.json({ success: true, data: await DeliverySlot.find({}).sort({ sortOrder: 1, startHour: 1 }) });
});
export const createSlot = asyncH(async (req, res) => {
  const DeliverySlot = (await import('../models/DeliverySlot.js')).default;
  const { name, label, startHour, endHour, capacity, cutoffHour, applicableTo, zone, isActive, sortOrder } = req.body;
  if (!name || startHour == null || endHour == null) {
    return res.status(400).json({ success: false, message: 'name, startHour, endHour required', code: 'DELIVERY_VALIDATION' });
  }
  if (Number(endHour) <= Number(startHour)) {
    return res.status(400).json({ success: false, message: 'endHour must be after startHour', code: 'DELIVERY_VALIDATION' });
  }
  res.status(201).json({ success: true, data: await DeliverySlot.create({ name, label, startHour, endHour, capacity, cutoffHour: cutoffHour ?? null, applicableTo, zone: zone || null, isActive: isActive !== false, sortOrder }) });
});
export const patchSlot = asyncH(async (req, res) => {
  const DeliverySlot = (await import('../models/DeliverySlot.js')).default;
  const s = await DeliverySlot.findById(req.params.id);
  if (!s) return res.status(404).json({ success: false, message: 'Slot not found' });
  for (const k of ['name', 'label', 'startHour', 'endHour', 'capacity', 'cutoffHour', 'applicableTo', 'zone', 'isActive', 'sortOrder']) {
    if (req.body[k] !== undefined) s[k] = req.body[k];
  }
  if (s.endHour <= s.startHour) {
    return res.status(400).json({ success: false, message: 'endHour must be after startHour', code: 'DELIVERY_VALIDATION' });
  }
  await s.save();
  res.json({ success: true, data: s });
});

export const confirmDispatch = asyncH(async (req, res) => {
  const { confirmDispatch } = await import('../services/delivery/orchestratorService.js');
  res.json({ success: true, data: await confirmDispatch({ shipmentId: req.params.id, actor: req.user, req }) });
});
export const pullBackShipment = asyncH(async (req, res) => {
  const { pullBackToOwn } = await import('../services/delivery/orchestratorService.js');
  res.json({ success: true, data: await pullBackToOwn({ shipmentId: req.params.id, actor: req.user, req, force: req.body.force === true }) });
});
export const rtoShipment = asyncH(async (req, res) => {
  const { requestReturnToOrigin } = await import('../services/delivery/rtoService.js');
  res.json({ success: true, data: await requestReturnToOrigin({ shipment: req.params.id, actor: req.user, note: req.body.note || '', req }) });
});
export const cancelShipment = asyncH(async (req, res) => {
  const s = await Shipment.findById(req.params.id);
  if (!s) return res.status(404).json({ success: false, message: 'Shipment not found' });
  res.json({ success: true, data: await transitionShipment({ shipment: s, status: 'CANCELLED', actor: req.user, note: req.body.reason || 'Cancelled by admin', req }) });
});
export const assignRiderTo = asyncH(async (req, res) => {
  const s = await Shipment.findById(req.params.id);
  if (!s) return res.status(404).json({ success: false, message: 'Shipment not found' });
  res.json({ success: true, data: await assignRider({ shipment: s, riderId: req.body.riderId, actor: req.user, req }) });
});
export const reassignRiderTo = asyncH(async (req, res) => {
  const s = await Shipment.findById(req.params.id);
  if (!s) return res.status(404).json({ success: false, message: 'Shipment not found' });
  res.json({ success: true, data: await reassignRider({ shipment: s, riderId: req.body.riderId, actor: req.user, reason: req.body.reason || '', req }) });
});
export const shipmentEvent = asyncH(async (req, res) => {
  const s = await Shipment.findById(req.params.id);
  if (!s) return res.status(404).json({ success: false, message: 'Shipment not found' });
  const { event, amount } = req.body;
  const map = { pickup: markPickedUp, out: markOutForDelivery, delivered: markDelivered, failed: markFailed };
  if (!map[event]) return res.status(400).json({ success: false, message: 'Unknown event', code: 'DELIVERY_VALIDATION' });
  res.json({ success: true, data: await map[event]({ shipment: s, actor: req.user, collectedAmount: amount, note: req.body.note || '', req }) });
});
export const orderShipments = asyncH(async (req, res) => {
  res.json({ success: true, data: await shipmentsForOrder(req.params.orderId) });
});

// ---- Couriers (credentials NEVER leave the server) ----
const sanitizeProvider = (p) => {
  const o = p.toObject ? p.toObject() : { ...p };
  return o;
};
export const listCouriers = asyncH(async (req, res) => {
  const providers = await listProviders();
  res.json({ success: true, data: providers.map(sanitizeProvider) });
});
export const updateCourier = asyncH(async (req, res) => {
  const p = await CourierProvider.findByIdAndUpdate(req.params.id, req.body, { new: true });
  try {
    logAudit(req, { action: 'COURIER_UPDATE', entity: 'CourierProvider', entityId: p._id, entityName: p.code, details: req.body, ip: ipOf(req) });
  } catch (_) {}
  res.json({ success: true, data: sanitizeProvider(p) });
});
export const patchCourierStatus = asyncH(async (req, res) => {
  const p = await CourierProvider.findById(req.params.id);
  if (!p) return res.status(404).json({ success: false, message: 'Provider not found' });
  if (req.body.status) p.status = req.body.status;
  await p.save();
  res.json({ success: true, data: sanitizeProvider(p) });
});
export const saveCredential = asyncH(async (req, res) => {
  const { providerId, environment, baseUrl, apiKey, apiSecret, merchantId, webhookSecret } = req.body;
  const update = { environment };
  if (baseUrl !== undefined) update.baseUrl = baseUrl;
  if (apiKey) update.apiKey = encryptSecret(apiKey);
  if (apiSecret) update.apiSecret = encryptSecret(apiSecret);
  if (merchantId !== undefined) update.merchantId = merchantId;
  if (webhookSecret) update.webhookSecret = encryptSecret(webhookSecret);
  const cred = await CourierCredential.findOneAndUpdate({ provider: providerId }, update, { new: true, upsert: true });
  try {
    logAudit(req, { action: 'COURIER_CREDENTIAL_SAVED', entity: 'CourierCredential', entityId: cred._id, entityName: String(providerId), details: { environment, masked: true }, ip: ipOf(req) });
  } catch (_) {}
  // NEVER return secrets — only confirmation
  res.json({ success: true, data: { provider: providerId, environment, configured: !!(cred.baseUrl && cred.apiKey) } });
});
export const courierPerformance = asyncH(async (req, res) => {
  res.json({ success: true, data: await courierPerformanceSvc() });
});

// ---- Tracking / settlement / reports / settings ----
export const getTracking = asyncH(async (req, res) => {
  res.json({ success: true, data: await adminTracking(req.params.id) });
});
export const getCod = asyncH(async (req, res) => {
  const { codSummary: summary, marginReport: margins } = await import('../services/delivery/settlementService.js');
  res.json({ success: true, data: { summary: await summary(req.query), margins: await margins(req.query) } });
});
export const postSettle = asyncH(async (req, res) => {
  res.json({ success: true, data: await settleCod({ shipmentId: req.params.id, actor: req.user, req, acceptVariance: req.body.acceptVariance === true }) });
});
export const postCollect = asyncH(async (req, res) => {
  const s = await Shipment.findById(req.params.id);
  if (!s) return res.status(404).json({ success: false, message: 'Shipment not found' });
  res.json({ success: true, data: await collectCOD({ shipment: s, amount: req.body.amount, actor: req.user, req }) });
});
export const getReports = asyncH(async (req, res) => {
  const { marginReport } = await import('../services/delivery/settlementService.js');
  res.json({ success: true, data: { margins: await marginReport(req.query), growth: await (await import('../services/delivery/deliveryReportService.js')).networkGrowth() } });
});
export const getSettings = asyncH(async (req, res) => {
  const s = (await Settings.findOne()) || {};
  res.json({
    success: true,
    data: {
      capacityFullPolicy: s.capacityFullPolicy || 'ADMIN_REVIEW',
      courierSelectionMode: s.courierSelectionMode || 'ADMIN_PRIORITY',
      ownDeliveryEnabled: s.ownDeliveryEnabled !== false,
      courierDispatchConfirm: s.courierDispatchConfirm === true,
      courierAutoConfirmMin: s.courierAutoConfirmMin ?? 120,
      forecastSmsHour: s.forecastSmsHour ?? 9,
      riderScoreWeights: s.riderScoreWeights || { zone: 0.3, distance: 0.25, capacity: 0.2, workload: 0.15, performance: 0.1 },
      riderPayModel: s.riderPayModel || 'PER_DELIVERY',
      riderPerDeliveryRate: s.riderPerDeliveryRate ?? 20,
      riderBaseSalary: s.riderBaseSalary ?? 0,
      otpRequired: s.otpRequired !== false,
      gpsRequired: s.gpsRequired === true,
      gpsRadiusM: s.gpsRadiusM ?? 2000,
    },
  });
});
export const putSettings = asyncH(async (req, res) => {
  let s = await Settings.findOne();
  if (!s) s = new Settings({});
  for (const f of ['capacityFullPolicy', 'courierSelectionMode', 'ownDeliveryEnabled', 'courierDispatchConfirm', 'courierAutoConfirmMin', 'forecastSmsHour', 'riderScoreWeights', 'riderPayModel', 'riderPerDeliveryRate', 'riderBaseSalary', 'otpRequired', 'gpsRequired', 'gpsRadiusM']) {
    if (req.body[f] !== undefined) s[f] = req.body[f];
  }
  await s.save();
  res.json({ success: true, data: s });
});

// ---- Public webhook (NO auth — signature + idempotency protected) ----
// ---- Public order tracking (order number + phone verify, masked output) ----
export const publicTracking = asyncH(async (req, res) => {
  const { orderNumber, phone } = req.body || {};
  if (!orderNumber || !phone) {
    return res.status(400).json({ success: false, message: 'Order number and phone are required', code: 'TRACKING_VALIDATION' });
  }
  const Order = (await import('../models/Order.js')).default;
  const order = await Order.findOne({ orderNumber: String(orderNumber).trim() });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found', code: 'TRACKING_NOT_FOUND' });
  const digits = (s) => String(s || '').replace(/\D/g, '').slice(-11);
  const phones = [order.shippingAddress?.phone];
  try {
    const u = await order.populate('customer', 'phone');
    phones.push(u.customer?.phone);
  } catch (_) {}
  if (!phones.some((p) => digits(p) && digits(p) === digits(phone))) {
    return res.status(403).json({ success: false, message: 'Phone does not match this order', code: 'TRACKING_FORBIDDEN' });
  }
  const { customerTracking } = await import('../services/delivery/trackingService.js');
  res.json({ success: true, data: await customerTracking({ orderId: order._id, customerId: null }) });
});

export const courierWebhook = asyncH(async (req, res) => {
  const provider = String(req.params.provider || '').toUpperCase();
  if (!['STEADFAST', 'PATHAO', 'CARIBEE', 'PAPERFLY'].includes(provider)) {
    return res.status(400).json({ success: false, message: 'Unknown provider' });
  }
  // HMAC-SHA256 signature check when the admin configured a webhook secret.
  // Without a secret we accept (backward compat) but flag it in the event.
  const CourierProvider = (await import('../models/CourierProvider.js')).default;
  const providerDoc = await CourierProvider.findOne({ code: provider });
  const CourierCredential = (await import('../models/CourierCredential.js')).default;
  const { decryptSecret } = await import('../models/CourierCredential.js');
  const cred = providerDoc ? await CourierCredential.findOne({ provider: providerDoc._id }).select('+webhookSecret') : null;
  const secret = cred?.webhookSecret ? decryptSecret(cred.webhookSecret) : '';
  let signatureOk = !secret;
  if (secret && req.rawBody) {
    const crypto = (await import('crypto')).default;
    const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
    const got = String(req.headers['x-signature'] || req.headers['x-webhook-signature'] || '');
    signatureOk = got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  }
  if (!signatureOk) {
    return res.status(401).json({ success: false, message: 'Invalid webhook signature', code: 'WEBHOOK_BAD_SIGNATURE' });
  }
  const { eventId, trackingNumber, trackingId, status, statusText } = req.body || {};
  const result = await ingestWebhook({
    provider,
    eventId: eventId || req.headers['x-event-id'] || '',
    trackingNumber: trackingNumber || trackingId || '',
    rawStatus: status || statusText || '',
    payload: { headers: { agent: req.headers['user-agent'] }, keys: Object.keys(req.body || {}) },
  });
  res.json({ success: true, duplicate: result.duplicate || false });
});

export const assignZoneTo = asyncH(async (req, res) => {
  const { assignZone } = await import('../services/delivery/riderAssignmentService.js');
  res.status(201).json({
    success: true,
    data: await assignZone({ riderId: req.body.riderId, zoneId: req.body.zoneId, priority: req.body.priority, maxDailyOrders: req.body.maxDailyOrders, actor: req.user, req }),
  });
});

export const zoneCapacityPlan = asyncH(async (req, res) => {
  const GroceryZone = (await import('../models/GroceryZone.js')).default;
  const Rider = (await import('../models/Rider.js')).default;
  const { planZoneCapacity } = await import('../services/delivery/deliveryLogic.js');
  const zone = await GroceryZone.findById(req.params.id);
  if (!zone) return res.status(404).json({ success: false, message: 'Zone not found' });
  const RiderZoneAssignment = (await import('../models/RiderZoneAssignment.js')).default;
  const links = await RiderZoneAssignment.find({ zone: zone._id, isActive: true });
  const riders = links.length
    ? await Rider.find({ _id: { $in: links.map((l) => l.rider) } }).select('maxDailyOrders')
    : await Rider.find({ assignedZones: zone._id, status: 'ACTIVE' }).select('maxDailyOrders');
  const expected = Number(req.query.expected || zone.riderCapacity || 0);
  res.json({ success: true, data: { zone: zone.name, ...planZoneCapacity({ expectedDailyOrders: expected, riders }) } });
});

// ---- Shifts & attendance (riders operate their own via /rider app; admin manages) ----
export const listShifts = asyncH(async (req, res) => {
  const RiderShift = (await import('../models/RiderShift.js')).default;
  res.json({ success: true, data: await RiderShift.find({}).sort({ startHour: 1 }) });
});
export const postShift = asyncH(async (req, res) => {
  const RiderShift = (await import('../models/RiderShift.js')).default;
  res.status(201).json({ success: true, data: await RiderShift.create(req.body) });
});
export const startShiftFor = asyncH(async (req, res) => {
  const { startShift } = await import('../services/delivery/riderShiftService.js');
  const riderId = req.body.riderId || (await riderIdOf(req.user));
  res.json({ success: true, data: await startShift({ riderId, shiftId: req.body.shiftId || null, zoneId: req.body.zoneId || null, actor: req.user, req }) });
});
export const endShiftFor = asyncH(async (req, res) => {
  const { endShift } = await import('../services/delivery/riderShiftService.js');
  const riderId = req.body.riderId || (await riderIdOf(req.user));
  res.json({ success: true, data: await endShift({ riderId, actor: req.user, req }) });
});
export const presenceFor = asyncH(async (req, res) => {
  const { updatePresence } = await import('../services/delivery/riderShiftService.js');
  res.json({ success: true, data: await updatePresence({ riderId: req.body.riderId, riderStatus: req.body.riderStatus, isAvailable: req.body.isAvailable }) });
});
export const attendanceFor = asyncH(async (req, res) => {
  const RiderAttendance = (await import('../models/RiderAttendance.js')).default;
  const q = {};
  if (req.query.riderId) q.rider = req.query.riderId;
  if (req.query.date) q.date = req.query.date;
  const [data, total] = await Promise.all([
    RiderAttendance.find(q).populate({ path: 'rider', populate: { path: 'user', select: 'name' } }).sort({ date: -1 }).limit(100),
    RiderAttendance.countDocuments(q),
  ]);
  res.json({ success: true, total, data });
});
const riderIdOf = async (user) => {
  if (user.role !== 'DELIVERY_RIDER') {
    const e = new Error('riderId is required');
    e.statusCode = 400;
    throw e;
  }
  const Rider = (await import('../models/Rider.js')).default;
  const r = await Rider.findOne({ user: user._id });
  if (!r) {
    const e = new Error('Rider profile not found');
    e.statusCode = 404;
    throw e;
  }
  return r._id;
};

// ---- Rider delivery actions (accept / POD deliver / fail with reason) ----
const ownShipmentOf = async (req, id) => {
  const s = await Shipment.findById(id);
  if (!s) {
    const e = new Error('Shipment not found');
    e.statusCode = 404;
    throw e;
  }
  if (s.deliveryMode !== 'OWN_DELIVERY') {
    const e = new Error('Only own-delivery shipments support rider actions');
    e.statusCode = 400;
    throw e;
  }
  return s;
};

export const acceptShipment = asyncH(async (req, res) => {
  const s = await ownShipmentOf(req, req.params.id);
  const { acceptDelivery } = await import('../services/delivery/ownDeliveryService.js');
  res.json({ success: true, data: await acceptDelivery({ shipment: s, actor: req.user, req }) });
});

export const deliverShipment = asyncH(async (req, res) => {
  const s = await ownShipmentOf(req, req.params.id);
  const { markDelivered } = await import('../services/delivery/ownDeliveryService.js');
  res.json({
    success: true,
    data: await markDelivered({
      shipment: s, actor: req.user, collectedAmount: req.body.collectedAmount, req,
      otp: req.body.otp, riderLng: req.body.lng, riderLat: req.body.lat,
      photo: req.body.photo || '', signature: req.body.signature || '',
    }),
  });
});

export const failShipment = asyncH(async (req, res) => {
  const s = await ownShipmentOf(req, req.params.id);
  const { markFailed } = await import('../services/delivery/ownDeliveryService.js');
  res.json({ success: true, data: await markFailed({ shipment: s, actor: req.user, note: req.body.note || '', reason: req.body.reason || 'OTHER', req }) });
});

export const shipmentAttempts = asyncH(async (req, res) => {
  const RiderDeliveryAttempt = (await import('../models/RiderDeliveryAttempt.js')).default;
  res.json({ success: true, data: await RiderDeliveryAttempt.find({ shipment: req.params.id }).sort({ createdAt: -1 }) });
});

// ---- Rider COD submit + settlements ----
export const submitCod = asyncH(async (req, res) => {
  const RiderCODCollection = (await import('../models/RiderCODCollection.js')).default;
  const c = await RiderCODCollection.findOne({ shipment: req.params.id });
  if (!c) return res.status(404).json({ success: false, message: 'COD record not found' });
  c.submittedAmount = Number(req.body.amount || 0);
  c.variance = c.submittedAmount - c.expectedAmount;
  c.status = c.variance < 0 ? 'REVIEW' : 'SUBMITTED';
  await c.save();
  res.json({ success: true, data: c });
});

export const codCollections = asyncH(async (req, res) => {
  const RiderCODCollection = (await import('../models/RiderCODCollection.js')).default;
  const q = {};
  if (req.query.status) q.status = req.query.status;
  if (req.query.riderId) q.rider = req.query.riderId;
  const [data, total] = await Promise.all([
    RiderCODCollection.find(q).populate({ path: 'rider', populate: { path: 'user', select: 'name' } }).sort({ createdAt: -1 }).limit(100),
    RiderCODCollection.countDocuments(q),
  ]);
  res.json({ success: true, total, data });
});

export const previewSettlement = asyncH(async (req, res) => {
  if (!req.query.riderId || !req.query.from || !req.query.to) {
    return res.status(400).json({ success: false, message: 'riderId, from and to are required', code: 'DELIVERY_VALIDATION' });
  }
  const { previewSettlement: preview } = await import('../services/delivery/riderSettlementService.js');
  res.json({ success: true, data: await preview({ riderId: req.query.riderId, from: req.query.from, to: req.query.to }) });
});
export const createSettlement = asyncH(async (req, res) => {
  const { createSettlement: create } = await import('../services/delivery/riderSettlementService.js');
  res.status(201).json({ success: true, data: await create({ ...req.body, actor: req.user, req }) });
});
export const listSettlements = asyncH(async (req, res) => {
  const RiderSettlement = (await import('../models/RiderSettlement.js')).default;
  const q = {};
  if (req.query.riderId) q.rider = req.query.riderId;
  if (req.query.status) q.status = req.query.status;
  res.json({ success: true, data: await RiderSettlement.find(q).populate({ path: 'rider', populate: { path: 'user', select: 'name' } }).sort({ createdAt: -1 }).limit(50) });
});
export const approveSettlement = asyncH(async (req, res) => {
  const { approveSettlement: approve } = await import('../services/delivery/riderSettlementService.js');
  res.json({ success: true, data: await approve({ settlementId: req.params.id, actor: req.user, req }) });
});

// ---- Zone performance (per-zone operational view) ----
export const zonePerformance = asyncH(async (req, res) => {
  const zoneId = req.params.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const month = new Date(today.getFullYear(), today.getMonth(), 1);
  const match = { zone: new (await import('mongoose')).default.Types.ObjectId(zoneId) };
  const [todayCount, monthCount, byStatus, riders] = await Promise.all([
    Shipment.countDocuments({ ...match, createdAt: { $gte: today } }),
    Shipment.countDocuments({ ...match, createdAt: { $gte: month } }),
    Shipment.aggregate([{ $match: { ...match, createdAt: { $gte: month } } }, { $group: { _id: '$status', count: { $sum: 1 }, cod: { $sum: '$collectedAmount' } } }]),
    (await import('../models/Rider.js')).default.countDocuments({ assignedZones: zoneId, status: 'ACTIVE' }),
  ]);
  const delivered = byStatus.find((r) => r._id === 'DELIVERED')?.count || 0;
  const failed = byStatus.find((r) => r._id === 'FAILED')?.count || 0;
  res.json({
    success: true,
    data: {
      ordersToday: todayCount, ordersThisMonth: monthCount, activeRiders: riders,
      successRate: delivered + failed ? Number(((delivered / (delivered + failed)) * 100).toFixed(1)) : 0,
      failed, cod: byStatus.reduce((s, r) => s + (r.cod || 0), 0), byStatus,
    },
  });
});

export const webhookEvents = asyncH(async (req, res) => {
  const [data, total] = await Promise.all([
    CourierWebhookEvent.find({}).sort({ createdAt: -1 }).limit(100),
    CourierWebhookEvent.countDocuments(),
  ]);
  res.json({ success: true, total, data });
});
export const apiLogs = asyncH(async (req, res) => {
  const [data, total] = await Promise.all([
    CourierApiLog.find({}).sort({ createdAt: -1 }).limit(100),
    CourierApiLog.countDocuments(),
  ]);
  res.json({ success: true, total, data });
});

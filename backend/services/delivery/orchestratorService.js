import Order from '../../models/Order.js';
import { resolveCoverage } from './coverageService.js';
import { decideRoute, backoffMs } from './deliveryLogic.js';
import { createShipment } from './shipmentService.js';
import { createDelivery } from './ownDeliveryService.js';
import { selectCourier, nextFallback, recordProviderResult } from './courierSelectionService.js';
import { getAdapter } from './adapters/index.js';
import CourierWebhookEvent from '../../models/CourierWebhookEvent.js';
import { normalizeStatus } from './deliveryLogic.js';
import { transitionShipment } from './shipmentService.js';

const MAX_RETRIES = 3;

// Backend-only routing. Frontend delivery mode/charge is NEVER trusted.
export const routeOrder = async ({ orderId, actor = null, manualCourier = null, req = null, attempt = 1 }) => {
  const order = await Order.findById(orderId);
  if (!order) {
    const e = new Error('Order not found');
    e.statusCode = 404;
    throw e;
  }

  const addr = order.shippingAddress || {};
  const coverage = await resolveCoverage({
    placeId: addr.placeId || addr.barikoiLocationId,
    uCode: addr.uCode,
    lat: addr.latitude,
    lng: addr.longitude,
    district: addr.city,
  });

  const { deliveryMode } = decideRoute({ coverage });

  // Charge snapshot: customer charge from order, actual cost by mode
  const customerCharge = order.deliveryCharge || 0;

  if (deliveryMode === 'OWN_DELIVERY') {
    const actualCost = coverage ? (await ownZoneCost(coverage.zoneId)) : 0;
    const { shipment } = await createShipment({
      order, deliveryMode, provider: 'OWN_RIDER', coverage: coverage || {},
      charge: { customerCharge, actualCost }, actor, attempt, req,
    });
    const result = await createDelivery({ shipment, coverage, actor, req });
    // Capacity-full + policy USE_EXTERNAL_COURIER → fall through to courier
    if (!result.assigned && result.fallbackPolicy === 'USE_EXTERNAL_COURIER') {
      return routeExternal({ order, coverage, actor, req, attempt });
    }
    return { shipment: result.shipment, deliveryMode, assigned: result.assigned, fallbackPolicy: result.fallbackPolicy };
  }

  return routeExternal({ order, coverage, actor, req, attempt, manualCourier });
};

const ownZoneCost = async (zoneId) => {
  try {
    const GroceryZone = (await import('../../models/GroceryZone.js')).default;
    const z = await GroceryZone.findById(zoneId).select('actualDeliveryCost');
    return z?.actualDeliveryCost ?? 40;
  } catch (_) {
    return 40;
  }
};

const routeExternal = async ({ order, coverage, actor, req, attempt, manualCourier = null }) => {
  const codNeeded = order.paymentMethod === 'COD';
  const district = order.shippingAddress?.city || '';
  const { provider, chain } = await selectCourier({ codNeeded, district, manualCode: manualCourier });

  if (!provider) {
    // No active courier — shipment parked for admin review (never lost)
    const { shipment } = await createShipment({
      order, deliveryMode: 'EXTERNAL_COURIER', provider: 'STEADFAST',
      coverage: coverage || {}, charge: { customerCharge: order.deliveryCharge || 0, actualCost: 0 },
      actor, attempt, req,
    });
    shipment.status = 'PENDING_ASSIGNMENT';
    shipment.lastError = 'No active courier provider — admin review required';
    shipment.statusHistory.push({ status: 'PENDING_ASSIGNMENT', note: shipment.lastError });
    await shipment.save();
    return { shipment, deliveryMode: 'EXTERNAL_COURIER', assigned: false, fallbackPolicy: 'ADMIN_REVIEW' };
  }

  const { shipment } = await createShipment({
    order, deliveryMode: 'EXTERNAL_COURIER', provider: provider.code,
    coverage: coverage || {}, charge: { customerCharge: order.deliveryCharge || 0, actualCost: 0 },
    actor, attempt, req,
  });

  // Confirm gate: Order Manager approves the courier booking first.
  // Disabled by default (current auto behavior); enable via settings.
  const Settings = (await import('../../models/Settings.js')).default;
  const policy = (await Settings.findOne().lean().catch(() => null)) || {};
  if (policy.courierDispatchConfirm) {
    shipment.awaitingConfirm = true;
    shipment.status = 'PENDING_ASSIGNMENT';
    shipment.statusHistory.push({ status: 'PENDING_ASSIGNMENT', note: `Awaiting dispatch confirm → ${provider.code}` });
    await shipment.save();
    return { shipment, deliveryMode: 'EXTERNAL_COURIER', assigned: false, awaitingConfirm: true, provider: provider.code };
  }

  return bookExternalShipment({ shipment, order, provider, chain, actor, req });
};

// Adapter booking with retry + fallback (idempotent — same shipment row).
// Shared by auto-route and manual confirm (never double-books).
const bookExternalShipment = async ({ shipment, order, provider, chain = [], actor = null, req = null }) => {
  // Attempt adapter call with retry + fallback (idempotent — same shipment row)
  let lastError = '';
  const adapter = getAdapter(provider.code);
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await adapter.createShipment({ providerDoc: provider, shipment, order });
      if (res.ok) {
        shipment.courierShipmentId = res.shipmentId || '';
        shipment.trackingNumber = res.trackingNumber || '';
        shipment.actualDeliveryCost = res.cost || 0;
        shipment.deliveryMargin = shipment.customerDeliveryCharge - shipment.actualDeliveryCost;
        shipment.status = 'PENDING_PICKUP';
        shipment.statusHistory.push({ status: 'PENDING_PICKUP', note: `Created via ${provider.code}` });
        await shipment.save();
        await recordProviderResult({ code: provider.code, success: true });
        try {
          order.trackingId = shipment.trackingNumber || shipment.shipmentNo;
          await order.save({ validateBeforeSave: false });
        } catch (_) {}
        return { shipment, deliveryMode: 'EXTERNAL_COURIER', assigned: true };
      }
      lastError = res.message || res.code;
    } catch (e) {
      lastError = e.message;
    }
    await new Promise((r) => setTimeout(r, backoffMs(i + 1)));
  }

  await recordProviderResult({ code: provider.code, success: false });
  shipment.lastError = lastError || 'Courier create failed';
  await shipment.save();

  // Fallback chain (same shipment row updated — never a duplicate shipment)
  for (const fb of chain) {
    const fbAdapter = getAdapter(fb.code);
    try {
      const res = await fbAdapter.createShipment({ providerDoc: fb, shipment, order });
      if (res.ok) {
        shipment.provider = fb.code;
        shipment.courierShipmentId = res.shipmentId || '';
        shipment.trackingNumber = res.trackingNumber || '';
        shipment.actualDeliveryCost = res.cost || 0;
        shipment.deliveryMargin = shipment.customerDeliveryCharge - shipment.actualDeliveryCost;
        shipment.status = 'PENDING_PICKUP';
        shipment.statusHistory.push({ status: 'PENDING_PICKUP', note: `Fallback to ${fb.code}` });
        await shipment.save();
        await recordProviderResult({ code: fb.code, success: true });
        return { shipment, deliveryMode: 'EXTERNAL_COURIER', assigned: true, fallbackFrom: provider.code };
      }
    } catch (_) {}
  }
  return { shipment, deliveryMode: 'EXTERNAL_COURIER', assigned: false, fallbackPolicy: 'ADMIN_REVIEW', error: lastError };
};

// Order Manager confirm → release a held courier booking (same idempotent row).
export const confirmDispatch = async ({ shipmentId, actor = null, req = null, auto = false } = {}) => {
  const Shipment = (await import('../../models/Shipment.js')).default;
  const s = await Shipment.findById(shipmentId);
  if (!s) throw Object.assign(new Error('Shipment not found'), { statusCode: 404 });
  if (!s.awaitingConfirm) return { shipment: s, alreadyReleased: true };
  s.awaitingConfirm = false;
  s.confirmedBy = actor?._id || null;
  s.confirmedAt = new Date();
  s.statusHistory.push({ status: s.status, note: auto ? 'Auto-confirmed (timer)' : 'Dispatch confirmed by Order Manager' });
  await s.save();
  const order = await Order.findById(s.order);
  const { provider, chain } = await selectCourier({ codNeeded: order?.paymentMethod === 'COD', district: order?.shippingAddress?.city || '' });
  const target = provider && provider.code === s.provider ? { provider, chain } : { provider: { code: s.provider }, chain: chain || [] };
  return bookExternalShipment({ shipment: s, order, provider: target.provider, chain: target.chain, actor, req });
};

// Auto-confirm sweep: held bookings older than the timer release themselves.
export const sweepDispatchConfirms = async () => {
  const Settings = (await import('../../models/Settings.js')).default;
  const policy = (await Settings.findOne().lean().catch(() => null)) || {};
  const mins = Number(policy.courierAutoConfirmMin || 0);
  if (mins <= 0) return { checked: 0, confirmed: 0 };
  const Shipment = (await import('../../models/Shipment.js')).default;
  const held = await Shipment.find({ awaitingConfirm: true, createdAt: { $lt: new Date(Date.now() - mins * 60000) } }).limit(50);
  const report = { checked: held.length, confirmed: 0, errors: [] };
  for (const s of held) {
    try {
      await confirmDispatch({ shipmentId: s._id, actor: null, req: null, auto: true });
      report.confirmed += 1;
    } catch (e) {
      report.errors.push({ shipment: String(s._id), error: e.message });
    }
  }
  return report;
};

// Pull-back: courier shipment → cancel at courier → re-route to own rider.
// Guarded: delivered/returned rows never move; courier-cancel failure blocks
// unless forced (parcel already back in hand).
export const pullBackToOwn = async ({ shipmentId, actor = null, req = null, force = false } = {}) => {
  const Shipment = (await import('../../models/Shipment.js')).default;
  const s = await Shipment.findById(shipmentId);
  if (!s) throw Object.assign(new Error('Shipment not found'), { statusCode: 404 });
  if (s.deliveryMode !== 'EXTERNAL_COURIER') {
    throw Object.assign(new Error('Only courier shipments can be pulled back'), { statusCode: 400, code: 'PULLBACK_INVALID_MODE' });
  }
  if (['DELIVERED', 'RETURNED', 'CANCELLED'].includes(s.status)) {
    throw Object.assign(new Error(`Cannot pull back a ${s.status} shipment`), { statusCode: 400, code: 'PULLBACK_INVALID_STATUS' });
  }
  // 1. Cancel at the courier (best-effort unless forced).
  if (s.courierShipmentId && !force) {
    try {
      const adapter = getAdapter(s.provider);
      const res = await adapter.cancelShipment({ providerDoc: null, shipment: s });
      if (res && res.ok === false) {
        throw new Error(res.message || 'Courier refused cancel');
      }
    } catch (e) {
      throw Object.assign(new Error(`Courier cancel failed: ${e.message} — use force if parcel is in hand`), { statusCode: 400, code: 'PULLBACK_COURIER_BLOCK' });
    }
  }
  // 2. Close the courier leg.
  s.status = 'CANCELLED';
  s.statusHistory.push({ status: 'CANCELLED', note: 'Pulled back to own network' });
  await s.save();
  // 3. Fresh own-network leg (new attempt number — idempotent row).
  const order = await Order.findById(s.order);
  const { resolveCoverage } = await import('./coverageService.js');
  const addr = order?.shippingAddress || {};
  const coverage = await resolveCoverage({
    placeId: addr.placeId || addr.barikoiLocationId, uCode: addr.uCode,
    lat: addr.latitude, lng: addr.longitude, district: addr.city,
  }).catch(() => null);
  const { createShipment } = await import('./shipmentService.js');
  const { createDelivery } = await import('./ownDeliveryService.js');
  const maxAttempt = await Shipment.find({ order: s.order }).select('attempt').lean()
    .then((rows) => Math.max(0, ...rows.map((r) => r.attempt || 1)));
  const { shipment: fresh } = await createShipment({
    order, deliveryMode: 'OWN_DELIVERY', provider: 'OWN_RIDER',
    coverage: {}, charge: { customerCharge: order?.deliveryCharge || 0, actualCost: 0 },
    actor, attempt: maxAttempt + 1, req,
  });
  // No zone coverage (outside own network): park for manual rider assignment
  // instead of crashing the scorer — the pull-back itself still succeeds.
  let result;
  if (coverage) {
    result = await createDelivery({ shipment: fresh, coverage, actor, req });
  } else {
    fresh.status = 'PENDING_ASSIGNMENT';
    fresh.statusHistory.push({ status: 'PENDING_ASSIGNMENT', note: 'Pulled back outside own zones — assign rider manually' });
    await fresh.save();
    result = { shipment: fresh, assigned: false, fallbackPolicy: 'ADMIN_REVIEW' };
  }
  try {
    const { logAudit } = await import('../../utils/auditLog.js');
    logAudit(req, { action: 'SHIPMENT_PULLBACK', entity: 'Shipment', entityId: fresh._id, entityName: fresh.shipmentNo, details: { from: s.shipmentNo, provider: s.provider }, ip: req?.ip || '' });
  } catch (_) {}
  return { pulled: s, shipment: result.shipment || fresh, assigned: result.assigned, fallbackPolicy: result.fallbackPolicy };
};

// SLA nudge: 2h reminded (SMS to order managers) → 4h escalated (senior +
// audit). Runs hourly; each stage fires once per shipment.
export const sweepDispatchSla = async ({ remindMin = 120, escalateMin = 240 } = {}) => {
  const Shipment = (await import('../../models/Shipment.js')).default;
  const now = Date.now();
  const due = await Shipment.find({ awaitingConfirm: true }).select('order shipmentNo provider createdAt confirmRemindedAt escalatedAt').lean();
  const report = { checked: due.length, reminded: 0, escalated: 0 };
  const User = (await import('../../models/User.js')).default;
  const managers = await User.find({ role: 'ORDER_MANAGER', phone: { $exists: true, $ne: '' } }).select('phone').lean();
  const { sendSMS } = await import('../../utils/notifications.js');
  for (const s of due) {
    const ageMin = (now - new Date(s.createdAt).getTime()) / 60000;
    try {
      if (ageMin >= escalateMin && !s.escalatedAt) {
        const Settings = (await import('../../models/Settings.js')).default;
        const st = await Settings.findOne().select('phone').lean();
        const toList = [...new Set([...managers.map((m) => m.phone), st?.phone].filter(Boolean))];
        for (const to of toList) {
          await sendSMS({ to, message: `[MadinaBazar] ESCALATION: courier dispatch ${s.shipmentNo} (${s.provider}) unconfirmed ${Math.round(ageMin / 60)}h — confirm now.` });
        }
        // Escalation supersedes reminder — set both so reruns stay silent.
        await Shipment.updateOne({ _id: s._id }, { escalatedAt: new Date(), confirmRemindedAt: new Date() });
        report.escalated += 1;
      } else if (ageMin >= remindMin && !s.confirmRemindedAt) {
        for (const m of managers) {
          await sendSMS({ to: m.phone, message: `[MadinaBazar] Confirm courier dispatch ${s.shipmentNo} (${s.provider}) — waiting ${Math.round(ageMin)}m.` });
        }
        await Shipment.updateOne({ _id: s._id }, { confirmRemindedAt: new Date() });
        report.reminded += 1;
      }
    } catch (e) {
      console.error('[dispatch-sla]', e.message);
    }
  }
  return report;
};

// Webhook ingest — idempotent per provider eventId, status normalized.
export const ingestWebhook = async ({ provider, eventId, trackingNumber, rawStatus, payload = {} }) => {
  const key = `${provider}:${eventId || trackingNumber}`;
  const existing = await CourierWebhookEvent.findOne({ provider, eventId: key });
  if (existing) return { event: existing, duplicate: true };

  const event = await CourierWebhookEvent.create({ provider, eventId: key, trackingNumber, rawStatus, payload });
  try {
    const Shipment = (await import('../../models/Shipment.js')).default;
    const shipment = await Shipment.findOne({ trackingNumber }) || await Shipment.findOne({ courierShipmentId: trackingNumber });
    if (!shipment) {
      event.status = 'IGNORED';
      await event.save();
      return { event, duplicate: false };
    }
    event.shipment = shipment._id;
    event.normalizedStatus = normalizeStatus(rawStatus);
    await transitionShipment({ shipment, status: event.normalizedStatus, note: `Webhook ${provider}: ${rawStatus}` });
    event.status = 'PROCESSED';
    await event.save();
    return { event, duplicate: false, shipment };
  } catch (e) {
    event.status = 'FAILED';
    event.error = e.message;
    await event.save();
    return { event, duplicate: false };
  }
};

export { nextFallback };

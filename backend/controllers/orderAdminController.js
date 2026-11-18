import Order from '../models/Order.js';
import Return from '../models/Return.js';
import OrderNote from '../models/OrderNote.js';
import OrderCommunication from '../models/OrderCommunication.js';
import OrderAuditLog from '../models/OrderAuditLog.js';
import { hasPermission } from '../utils/permissions.js';
import { queryOrders } from '../services/orderMgmt/orderQueryService.js';
import { orderDashboard, orderReports } from '../services/orderMgmt/orderDashboardService.js';
import { assertTransition, canCancel, CANCEL_REASONS, HOLD_REASONS } from '../services/orderMgmt/orderStatusService.js';
import { assignOrder, unassignOrder } from '../services/orderMgmt/orderAssignmentService.js';
import { logOrderAction } from '../services/orderMgmt/orderAuditService.js';

const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const err = (statusCode, message, code) => {
  const e = new Error(message);
  e.statusCode = statusCode;
  e.code = code || 'ORDER_ERROR';
  throw e;
};
const ipOf = (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '';

// Sensitive masking — phone/email/paymentMeta hidden without order.view_sensitive
const maskOrder = (order, canSeeSensitive) => {
  if (canSeeSensitive) return order;
  const o = order.toObject ? order.toObject() : { ...order };
  if (o.shippingAddress?.phone) o.shippingAddress.phone = `${String(o.shippingAddress.phone).slice(0, 4)}****`;
  if (o.customer?.phone) o.customer.phone = `${String(o.customer.phone).slice(0, 4)}****`;
  if (o.customer?.email) o.customer.email = '***@***';
  if (o.paymentMeta) o.paymentMeta = { masked: true };
  return o;
};

export const getDashboard = asyncH(async (req, res) => {
  res.json({ success: true, data: await orderDashboard() });
});

// Assignable staff pool — scoped endpoint so ORDER_MANAGER never needs /users access
export const getAgents = asyncH(async (req, res) => {
  const User = (await import('../models/User.js')).default;
  const agents = await User.find(
    { role: { $in: ['ORDER_MANAGER', 'SUPPORT_AGENT', 'SUPPORT_MANAGER', 'DELIVERY_MANAGER'] }, isActive: true },
    'name email role'
  ).sort({ name: 1 });
  res.json({ success: true, data: agents });
});

export const listOrders = asyncH(async (req, res) => {
  const [data, total] = await queryOrders({ ...req.query, status: req.query.status || req.params.status });
  const canSee = req.user.role === 'SUPER_ADMIN' || hasPermission(req.user, 'order.view_sensitive');
  res.json({ success: true, total, page: Number(req.query.page || 1), data: data.map((o) => maskOrder(o, canSee)) });
});

export const getOrderDetail = asyncH(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('customer', 'name email phone')
    .populate('assignedTo', 'name role')
    .populate('assignedBy', 'name role')
    .populate('assignedRider', 'name phone')
    .populate('deliveryArea', 'name deliveryCharge')
    .populate('statusHistory.changedBy', 'name role');
  if (!order) return res.status(404).json({ success: false, message: 'Order not found', code: 'ORDER_NOT_FOUND' });
  await logOrderAction({ order, action: 'ORDER_VIEW', actor: req.user, ip: ipOf(req) });
  const canSee = req.user.role === 'SUPER_ADMIN' || hasPermission(req.user, 'order.view_sensitive');
  res.json({ success: true, data: maskOrder(order, canSee) });
});

export const updateStatus = asyncH(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found', code: 'ORDER_NOT_FOUND' });
  const next = assertTransition(order.orderStatus, req.body.status);
  const prev = order.orderStatus;
  order.orderStatus = next;
  if (next === 'ON_HOLD') {
    const holdDays = Math.min(Math.max(Number(req.body.holdDays) || 3, 1), 30);
    order.hold = { isHeld: true, reason: req.body.reason || 'OTHER', note: req.body.note || '', heldBy: req.user._id, heldAt: new Date(), prevStatus: prev, expiresAt: new Date(Date.now() + holdDays * 86400000) };
  } else if (order.hold?.isHeld) {
    order.hold.isHeld = false;
  }
  order.statusHistory.push({ status: next, changedBy: req.user._id, note: req.body.note || `Status changed to ${next}`, timestamp: new Date() });
  if (next === 'DELIVERED' && order.paymentMethod === 'COD') order.paymentStatus = 'Paid';
  await order.save();
  await logOrderAction({ order, action: 'ORDER_STATUS_CHANGED', actor: req.user, oldValue: { status: prev }, newValue: { status: next }, reason: req.body.note || '', ip: ipOf(req) });

  // ORDER_CONFIRMED → revenue recognition (idempotent via refKey — safe if the
  // classic path already posted) + DELIVERY_ROUTING. Best-effort throughout.
  if (next === 'CONFIRMED') {
    try {
      const { recordSale } = await import('../services/accountingService.js');
      const full = await Order.findById(order._id);
      if (full) await recordSale(full, { actorId: req.user._id, req });
    } catch (e) {
      console.error('[sale autopilot]', e.message);
    }
    try {
      const { routeOrder } = await import('../services/delivery/orchestratorService.js');
      await routeOrder({ orderId: order._id, actor: req.user, req });
    } catch (e) {
      console.error('[delivery routing]', e.message);
    }
  }
  // Cancelled → cancel open own/courier shipments (best-effort)
  if (next === 'CANCELLED') {
    try {
      const Shipment = (await import('../models/Shipment.js')).default;
      const open = await Shipment.find({ order: order._id, status: { $nin: ['DELIVERED', 'CANCELLED', 'RETURNED'] } });
      const { transitionShipment } = await import('../services/delivery/shipmentService.js');
      for (const s of open) {
        try {
          await transitionShipment({ shipment: s, status: 'CANCELLED', actor: req.user, note: 'Order cancelled', req });
        } catch (_) {}
      }
    } catch (e) {
      console.error('[delivery cancel]', e.message);
    }
  }
  res.json({ success: true, data: order });
});

export const updatePriority = asyncH(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found', code: 'ORDER_NOT_FOUND' });
  if (!['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(req.body.priority)) err(400, 'Invalid priority', 'ORDER_INVALID_PRIORITY');
  const prev = order.priority;
  order.priority = req.body.priority;
  await order.save();
  await logOrderAction({ order, action: 'ORDER_PRIORITY_CHANGED', actor: req.user, oldValue: { priority: prev }, newValue: { priority: order.priority }, reason: req.body.reason || '', ip: ipOf(req) });
  res.json({ success: true, data: order });
});

// Limited edits: contact + address corrections only (audited, old/new values)
export const updateCustomer = asyncH(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found', code: 'ORDER_NOT_FOUND' });
  const prev = { fullName: order.shippingAddress?.fullName, phone: order.shippingAddress?.phone };
  if (req.body.fullName) order.shippingAddress.fullName = req.body.fullName;
  if (req.body.phone) order.shippingAddress.phone = req.body.phone;
  await order.save();
  await logOrderAction({ order, action: 'ORDER_EDITED', actor: req.user, oldValue: prev, newValue: { fullName: order.shippingAddress.fullName, phone: order.shippingAddress.phone }, reason: req.body.reason || 'Contact correction', ip: ipOf(req) });
  res.json({ success: true, data: order });
});

export const updateAddress = asyncH(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found', code: 'ORDER_NOT_FOUND' });
  const prev = { ...(order.shippingAddress?.toObject?.() || order.shippingAddress) };
  const a = order.shippingAddress || {};
  for (const f of ['address', 'area', 'city', 'latitude', 'longitude', 'placeId', 'uCode', 'barikoiLocationId']) {
    if (req.body[f] !== undefined) a[f] = req.body[f];
  }
  order.shippingAddress = a;
  await order.save();
  await logOrderAction({ order, action: 'ORDER_EDITED', actor: req.user, oldValue: prev, newValue: order.shippingAddress, reason: req.body.reason || 'Address correction', ip: ipOf(req) });
  res.json({ success: true, data: order });
});

export const assign = asyncH(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found', code: 'ORDER_NOT_FOUND' });
  const prev = { assignedTo: order.assignedTo, assignedTeam: order.assignedTeam };
  await assignOrder({ order, agentId: req.body.agentId || null, team: req.body.team || '', method: req.body.method || 'MANUAL', actor: req.user });
  await logOrderAction({ order, action: 'ORDER_ASSIGNED', actor: req.user, oldValue: prev, newValue: { assignedTo: order.assignedTo, team: order.assignedTeam, method: req.body.method || 'MANUAL' }, ip: ipOf(req) });
  res.json({ success: true, data: order });
});

export const unassign = asyncH(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found', code: 'ORDER_NOT_FOUND' });
  const prev = { assignedTo: order.assignedTo, assignedTeam: order.assignedTeam };
  await unassignOrder({ order });
  await logOrderAction({ order, action: 'ORDER_UNASSIGNED', actor: req.user, oldValue: prev, ip: ipOf(req) });
  res.json({ success: true, data: order });
});

export const hold = asyncH(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found', code: 'ORDER_NOT_FOUND' });
  if (!req.body.reason || !HOLD_REASONS.includes(req.body.reason)) err(400, 'Valid hold reason is required', 'ORDER_HOLD_REASON_REQUIRED');
  if (!req.body.note) err(400, 'Hold note is required', 'ORDER_HOLD_NOTE_REQUIRED');
  const prevStatus = order.orderStatus;
  order.orderStatus = assertTransition(order.orderStatus, 'ON_HOLD');
  const holdDays = Math.min(Math.max(Number(req.body.holdDays) || 3, 1), 30);
  order.hold = { isHeld: true, reason: req.body.reason, note: req.body.note, heldBy: req.user._id, heldAt: new Date(), prevStatus, expiresAt: new Date(Date.now() + holdDays * 86400000) };
  order.statusHistory.push({ status: 'ON_HOLD', changedBy: req.user._id, note: `${req.body.reason}: ${req.body.note}`, timestamp: new Date() });
  await order.save();
  await logOrderAction({ order, action: 'ORDER_HOLD', actor: req.user, newValue: order.hold, reason: req.body.note, ip: ipOf(req) });
  res.json({ success: true, data: order });
});

export const cancel = asyncH(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found', code: 'ORDER_NOT_FOUND' });
  if (!req.body.reason || !CANCEL_REASONS.includes(req.body.reason)) err(400, 'Valid cancellation reason is required', 'ORDER_CANCEL_REASON_REQUIRED');
  if (!canCancel(order.orderStatus)) err(400, `Order in ${order.orderStatus} cannot be cancelled`, 'ORDER_CANCEL_NOT_ALLOWED');
  const prev = order.orderStatus;
  order.orderStatus = order.orderStatus === 'Cancelled' ? 'Cancelled' : 'CANCELLED';
  order.cancellation = { reason: req.body.reason, note: req.body.note || '', cancelledBy: req.user._id, cancelledAt: new Date() };
  order.statusHistory.push({ status: order.orderStatus, changedBy: req.user._id, note: `Cancelled: ${req.body.reason}`, timestamp: new Date() });
  // Release stock via Inventory Service (idempotent per order — safe even if
  // the storefront flow already deducted; no double-restore possible)
  const { returnStock, returnComboStock } = await import('../services/inventory/stockService.js');
  for (const item of order.orderItems || []) {
    if (item.product) {
      await returnStock({
        productId: item.product,
        size: item.size || '',
        color: item.color || '',
        quantity: item.quantity,
        referenceId: order.orderNumber,
        actor: req.user,
        performedByType: 'HUMAN',
      });
    } else if (item.combo) {
      await returnComboStock({
        comboId: item.combo,
        quantity: item.quantity,
        referenceId: order.orderNumber,
        actor: req.user,
        performedByType: 'HUMAN',
      });
    }
  }
  await order.save();
  await logOrderAction({ order, action: 'ORDER_CANCELLED', actor: req.user, oldValue: { status: prev }, newValue: { status: order.orderStatus, reason: req.body.reason }, reason: req.body.note || '', ip: ipOf(req) });
  res.json({ success: true, data: order });
});

export const cancelItem = asyncH(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found', code: 'ORDER_NOT_FOUND' });
  if (!req.body.reason || !CANCEL_REASONS.includes(req.body.reason)) err(400, 'Valid cancellation reason is required', 'ORDER_CANCEL_REASON_REQUIRED');
  if (!canCancel(order.orderStatus)) err(400, `Order in ${order.orderStatus} cannot be partially cancelled`, 'ORDER_CANCEL_NOT_ALLOWED');

  const lines = order.orderItems || [];
  const { lineId, productId, size = '', color = '', quantity } = req.body;
  const line = lineId
    ? lines.id(lineId)
    : lines.find((l) => String(l.product) === String(productId) && (l.size || '') === size && (l.color || '') === color);
  if (!line) return res.status(404).json({ success: false, message: 'Order line not found', code: 'ORDER_LINE_NOT_FOUND' });
  const qty = Math.min(Math.max(Number(quantity) || line.quantity, 1), line.quantity);

  // Stock back first (per-line idempotent keys — safe on retry).
  const { returnStock, returnComboStock } = await import('../services/inventory/stockService.js');
  if (line.product) {
    await returnStock({ productId: line.product, size: line.size || '', color: line.color || '', quantity: qty, referenceId: `${order.orderNumber}#${line._id}`, actor: req.user, performedByType: 'HUMAN' });
  } else if (line.combo) {
    await returnComboStock({ comboId: line.combo, quantity: qty, referenceId: `${order.orderNumber}#${line._id}`, actor: req.user, performedByType: 'HUMAN' });
  }
  const lineTotal = (line.price || 0) * qty;

  // Shrink/remove the line; money math stays explicit (delivery + discount kept).
  line.quantity -= qty;
  if (line.quantity <= 0) order.orderItems.pull(line._id);
  order.subtotal = Math.max(0, (order.subtotal || 0) - lineTotal);
  order.totalAmount = Math.max(0, (order.subtotal || 0) + (order.deliveryCharge || 0) - (order.discount || 0));
  const emptied = (order.orderItems || []).length === 0;
  if (emptied) {
    order.orderStatus = order.orderStatus === 'Cancelled' ? 'Cancelled' : 'CANCELLED';
    order.cancellation = { reason: req.body.reason, note: req.body.note || 'Last line cancelled', cancelledBy: req.user._id, cancelledAt: new Date() };
  }
  order.statusHistory.push({ status: order.orderStatus, changedBy: req.user._id, note: `Item cancelled: ${line.name} × ${qty} (${req.body.reason})`, timestamp: new Date() });
  await order.save();
  await logOrderAction({ order, action: 'ORDER_ITEM_CANCELLED', actor: req.user, oldValue: { line: line.name, quantity: line.quantity + qty }, newValue: { quantity: line.quantity, lineTotal, orderTotal: order.totalAmount }, reason: req.body.reason, ip: ipOf(req) });

  // Books: reverse COGS always; reverse revenue only while unpaid
  // (paid value returns via recordRefund below — never both).
  try {
    const { recordSaleAdjustment } = await import('../services/accountingService.js');
    await recordSaleAdjustment({
      order,
      lineRef: `cancel:${line._id}:${qty}`,
      revenueDelta: (order.paidAmount || 0) > 0 ? 0 : lineTotal,
      cogsDelta: (Number(line.cost) || 0) * qty,
      reason: `Partial cancel ${line.name} × ${qty}`,
      actorId: req.user._id, req,
    });
  } catch (e) {
    console.error('[sale-adjust]', e.message);
  }

  // Paid order → partial refund through the real refund machine (best-effort).
  let refundOutcome = 'unpaid';
  if ((order.paidAmount || 0) > 0 && lineTotal > 0) {
    try {
      const ret = await Return.create({
        order: order._id, type: 'SALE_RETURN',
        items: [{ product: line.product || undefined, name: line.name, quantity: qty, price: line.price || 0 }],
        refundAmount: Math.min(lineTotal, order.paidAmount),
        reason: `Partial cancel: ${line.name} × ${qty}`,
        status: 'Refunded', refundStatus: 'Pending',
        refundMethod: order.paymentMethod === 'COD' ? 'Cash' : order.paymentMethod,
        createdBy: req.user._id,
      });
      const { processRefund } = await import('../services/refundService.js');
      ({ outcome: refundOutcome } = await processRefund(ret, { actor: req.user }));
      if (['paid', 'paid-zero', 'paid-cash'].includes(refundOutcome)) {
        const { recordRefund } = await import('../services/accountingService.js');
        await recordRefund({ order, amount: ret.refundAmount, method: order.paymentMethod, reason: 'Partial item cancel', actorId: req.user.id, req, returnRef: ret._id });
        ret.journalPosted = true;
        await ret.save({ validateBeforeSave: false });
      }
    } catch (e) {
      console.error('[partial-refund]', e.message);
    }
  }

  // Tell the customer (best-effort SMS).
  try {
    const phone = order.shippingAddress?.phone || order.customer?.phone;
    if (phone) {
      const { sendSMS } = await import('../utils/notifications.js');
      await sendSMS({ to: phone, message: `[MadinaBazar] ${line.name} × ${qty} removed from order ${order.orderNumber} (${req.body.reason === 'OUT_OF_STOCK' ? 'out of stock' : 'cancelled'}). ${refundOutcome.startsWith('paid') ? `Refund ৳${lineTotal} done.` : refundOutcome === 'unpaid' ? '' : 'Refund processing.'}` });
    }
  } catch (e) {
    console.error('[partial-sms]', e.message);
  }

  res.json({ success: true, data: order, refund: refundOutcome, emptied });
});

export const bulk = asyncH(async (req, res) => {
  const { ids, op, value, note } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    return res.status(400).json({ success: false, message: 'ids must be 1–100 order ids', code: 'ORDER_BULK_VALIDATION' });
  }
  // Per-op permission (route stays open; the op decides the gate).
  const need = op === 'status' ? ['ORDER_UPDATE', 'order.status.update']
    : op === 'priority' ? ['order.priority.update', 'ORDER_UPDATE']
    : op === 'assign' ? ['order.assign', 'ORDER_ASSIGN_RIDER']
    : null;
  if (!need || !need.some((p) => hasPermission(req.user, p))) {
    return res.status(403).json({ success: false, message: 'Not allowed for this bulk operation', code: 'ORDER_BULK_FORBIDDEN' });
  }
  if (op === 'priority' && !['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(value)) {
    return res.status(400).json({ success: false, message: 'Invalid priority', code: 'ORDER_INVALID_PRIORITY' });
  }

  const results = [];
  for (const id of ids) {
    try {
      const order = await Order.findById(id);
      if (!order) throw Object.assign(new Error('Order not found'), { code: 'ORDER_NOT_FOUND' });
      if (op === 'status') {
        const prev = order.orderStatus;
        order.orderStatus = assertTransition(prev, value);
        order.statusHistory.push({ status: order.orderStatus, changedBy: req.user._id, note: note || `Bulk status → ${value}`, timestamp: new Date() });
        await order.save();
        await logOrderAction({ order, action: 'ORDER_STATUS_CHANGED', actor: req.user, oldValue: { status: prev }, newValue: { status: order.orderStatus }, reason: note || 'bulk', ip: ipOf(req) });
      } else if (op === 'priority') {
        const prev = order.priority;
        order.priority = value;
        await order.save();
        await logOrderAction({ order, action: 'ORDER_PRIORITY_CHANGED', actor: req.user, oldValue: { priority: prev }, newValue: { priority: value }, reason: note || 'bulk', ip: ipOf(req) });
      } else {
        const { assignOrder } = await import('../services/orderMgmt/orderAssignmentService.js');
        const prev = { assignedTo: order.assignedTo, assignedTeam: order.assignedTeam };
        await assignOrder({ order, agentId: value?.agentId || null, team: value?.team || '', method: 'BULK', actor: req.user });
        await logOrderAction({ order, action: 'ORDER_ASSIGNED', actor: req.user, oldValue: prev, newValue: { assignedTo: order.assignedTo, team: order.assignedTeam, method: 'BULK' }, ip: ipOf(req) });
      }
      results.push({ id, ok: true });
    } catch (e) {
      results.push({ id, ok: false, message: e.message, code: e.code || undefined });
    }
  }
  const failed = results.filter((r) => !r.ok);
  res.json({ success: true, data: { total: results.length, succeeded: results.length - failed.length, failed: failed.length, results } });
});

export const proposeSubstitute = asyncH(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found', code: 'ORDER_NOT_FOUND' });
  if (!canCancel(order.orderStatus)) err(400, `Order in ${order.orderStatus} cannot be modified`, 'ORDER_CANCEL_NOT_ALLOWED');
  const { lineId, substituteProductId, quantity, note } = req.body;
  const line = (order.orderItems || []).id(lineId);
  if (!line?.product) return res.status(404).json({ success: false, message: 'Order line not found', code: 'ORDER_LINE_NOT_FOUND' });
  const qty = Math.min(Math.max(Number(quantity) || line.quantity, 1), line.quantity);
  const Product = (await import('../models/Product.js')).default;
  const sub = await Product.findById(substituteProductId);
  if (!sub || !sub.isActive) return res.status(400).json({ success: false, message: 'Substitute product unavailable', code: 'ORDER_SUBSTITUTE_INVALID' });
  const { checkAvailable } = await import('../services/inventory/stockService.js');
  const avail = await checkAvailable({ productId: sub._id, quantity: qty });
  if (!avail.sufficient) return res.status(400).json({ success: false, message: `Substitute has only ${avail.available} available`, code: 'INSUFFICIENT_STOCK' });

  order.substitutions.push({
    line: line._id, substituteProduct: sub._id, substituteName: sub.name,
    quantity: qty, priceDiff: (sub.salePrice || sub.regularPrice || 0) * qty - (line.price || 0) * qty,
    note: note || '', createdBy: req.user._id,
  });
  await order.save();
  await logOrderAction({ order, action: 'ORDER_SUBSTITUTE_PROPOSED', actor: req.user, newValue: { line: line.name, substitute: sub.name, quantity: qty }, reason: note || '', ip: ipOf(req) });
  try {
    const phone = order.shippingAddress?.phone;
    if (phone) {
      const { sendSMS } = await import('../utils/notifications.js');
      await sendSMS({ to: phone, message: `[MadinaBazar] ${line.name} unavailable — substitute offered: ${sub.name} × ${qty}. Approve in My Orders.` });
    }
  } catch (e) {
    console.error('[sub-sms]', e.message);
  }
  res.status(201).json({ success: true, data: order });
});

export const reopen = asyncH(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found', code: 'ORDER_NOT_FOUND' });
  const canon = order.orderStatus;
  if (!['Cancelled', 'CANCELLED', 'FAILED'].includes(canon)) err(400, 'Only cancelled/failed orders can be reopened', 'ORDER_REOPEN_NOT_ALLOWED');
  order.orderStatus = 'PENDING_VERIFICATION';
  order.cancellation = { reason: '', note: '', cancelledBy: null, cancelledAt: null };
  order.statusHistory.push({ status: 'PENDING_VERIFICATION', changedBy: req.user._id, note: req.body.note || 'Reopened', timestamp: new Date() });
  await order.save();
  await logOrderAction({ order, action: 'ORDER_REOPENED', actor: req.user, oldValue: { status: canon }, newValue: { status: order.orderStatus }, reason: req.body.note || '', ip: ipOf(req) });
  res.json({ success: true, data: order });
});

// Refund goes ORDER_MANAGER -> request only. REFUND_MANAGER completes via Payment service.
export const refundRequest = asyncH(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found', code: 'ORDER_NOT_FOUND' });
  const ret = await Return.create({
    order: order._id,
    type: 'SALE_RETURN',
    items: (order.orderItems || []).filter((i) => i.product).map((i) => ({ product: i.product, name: i.name, quantity: i.quantity, price: i.price })),
    refundAmount: req.body.amount || order.paidAmount || order.totalAmount,
    reason: req.body.reason || 'ORDER_MANAGER refund request',
    status: 'Requested',
    createdBy: req.user._id,
  });
  await logOrderAction({ order, action: 'REFUND_REQUESTED', actor: req.user, newValue: { returnId: ret._id, amount: ret.refundAmount }, reason: req.body.reason || '', ip: ipOf(req) });
  res.status(201).json({ success: true, data: ret });
});

export const getNotes = asyncH(async (req, res) => {
  const q = { order: req.params.id };
  // Customers see only CUSTOMER notes; staff see all
  if (req.user.role === 'CUSTOMER') q.visibility = 'CUSTOMER';
  res.json({ success: true, data: await OrderNote.find(q).populate('createdBy', 'name role').sort({ createdAt: -1 }) });
});

export const addNote = asyncH(async (req, res) => {
  if (!req.body.content) err(400, 'Note content is required', 'ORDER_NOTE_REQUIRED');
  const note = await OrderNote.create({
    order: req.params.id,
    visibility: req.body.visibility === 'CUSTOMER' ? 'CUSTOMER' : 'INTERNAL',
    content: req.body.content,
    createdBy: req.user._id,
  });
  const order = await Order.findById(req.params.id);
  if (order) await logOrderAction({ order, action: 'ORDER_NOTE_CREATED', actor: req.user, newValue: { visibility: note.visibility }, ip: ipOf(req) });
  res.status(201).json({ success: true, data: note });
});

export const getTimeline = asyncH(async (req, res) => {
  const [order, audits] = await Promise.all([
    Order.findById(req.params.id).populate('statusHistory.changedBy', 'name role').select('orderNumber orderStatus statusHistory createdAt'),
    OrderAuditLog.find({ order: req.params.id }).populate('actor', 'name role').sort({ createdAt: 1 }),
  ]);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found', code: 'ORDER_NOT_FOUND' });
  res.json({ success: true, data: { statusHistory: order.statusHistory, audits } });
});

export const sendCommunication = asyncH(async (req, res) => {
  if (!req.body.message) err(400, 'Message is required', 'ORDER_COMM_REQUIRED');
  const order = await Order.findById(req.params.id).populate('customer', 'name email phone');
  if (!order) return res.status(404).json({ success: false, message: 'Order not found', code: 'ORDER_NOT_FOUND' });
  const comm = await OrderCommunication.create({
    order: order._id,
    customer: order.customer?._id || null,
    sender: req.user._id,
    recipient: req.body.recipient || order.customer?.phone || order.customer?.email || '',
    channel: req.body.channel || 'IN_APP',
    message: req.body.message,
    status: 'SENT',
  });
  await logOrderAction({ order, action: 'ORDER_COMMUNICATION_SENT', actor: req.user, newValue: { channel: comm.channel }, ip: ipOf(req) });
  res.status(201).json({ success: true, data: comm });
});

export const getReports = asyncH(async (req, res) => {
  res.json({ success: true, data: await orderReports(req.query) });
});

export const exportCsv = asyncH(async (req, res) => {
  const [orders] = await queryOrders({ ...req.query, page: 1, limit: 2000 });
  const rows = [['orderNumber', 'status', 'payment', 'amount', 'customer', 'createdAt']];
  for (const o of orders) {
    rows.push([o.orderNumber, o.orderStatus, o.paymentStatus, o.totalAmount, o.customer?.name || '', new Date(o.createdAt).toISOString()]);
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
  res.send(rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'));
});

export const getAuditLogs = asyncH(async (req, res) => {
  const q = {};
  if (req.query.order) q.order = req.query.order;
  if (req.query.action) q.action = req.query.action;
  res.json({ success: true, data: await OrderAuditLog.find(q).populate('actor', 'name role').sort({ createdAt: -1 }).limit(200) });
});

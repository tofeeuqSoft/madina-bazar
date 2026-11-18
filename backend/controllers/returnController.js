import Return from '../models/Return.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { recordRefund } from '../services/accountingService.js';
import { logAudit } from '../utils/auditLog.js';

export const getReturns = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    const q = {};
    if (type) q.type = type;
    if (status) q.status = status;
    const skip = (Number(page) - 1) * Number(limit);
    const [list, total] = await Promise.all([
      Return.find(q).populate('order', 'orderNumber totalAmount').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Return.countDocuments(q),
    ]);
    res.json({ success: true, data: list, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const createReturn = async (req, res) => {
  try {
    const doc = await Return.create({ ...req.body, createdBy: req.user?.id });
    res.status(201).json({ success: true, data: doc });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

// Customer self-service return request — own delivered orders only.
// Inspection + refund stay with staff (Return → Requested, never auto-approved).
export const requestReturn = async (req, res) => {
  try {
    const { orderId, items, reason } = req.body;
    if (!orderId || !reason) {
      return res.status(400).json({ success: false, message: 'orderId and reason are required', code: 'RETURN_VALIDATION' });
    }
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (String(order.customer) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not your order', code: 'RETURN_FORBIDDEN' });
    }
    if (!['Delivered', 'DELIVERED'].includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: 'Only delivered orders can be returned', code: 'RETURN_NOT_ELIGIBLE' });
    }
    const existing = await Return.findOne({ order: orderId, status: { $in: ['Requested', 'Approved'] } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A return request already exists for this order', code: 'RETURN_DUPLICATE' });
    }
    const lines = (items?.length ? items : order.orderItems || [])
      .filter((i) => i.product)
      .map((i) => ({ product: i.product, name: i.name, quantity: i.quantity, price: i.price }));
    if (!lines.length) {
      return res.status(400).json({ success: false, message: 'No returnable items', code: 'RETURN_NO_ITEMS' });
    }
    const refundAmount = lines.reduce((s, i) => s + i.price * i.quantity, 0);
    const doc = await Return.create({
      order: orderId,
      type: 'SALE_RETURN',
      items: lines,
      refundAmount,
      reason,
      status: 'Requested',
      createdBy: req.user.id,
    });
    res.status(201).json({ success: true, data: doc });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

export const updateReturnStatus = async (req, res) => {
  try {
    const { status, refundStatus, refundMethod, note } = req.body;
    const doc = await Return.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Return not found' });
    if (status) doc.status = status;
    if (refundStatus) doc.refundStatus = refundStatus;
    if (refundMethod) doc.refundMethod = refundMethod;
    if (note != null) doc.note = note;

    // On refund of a sale return: restock via Inventory Service (idempotent
    // per return — legacy direct-restock path now audited with movements)
    if (doc.type === 'SALE_RETURN' && doc.status === 'Refunded' && !doc._restored) {
      try {
        const { inspectReturn } = await import('../services/inventory/returnInventoryService.js');
        await inspectReturn({
          returnDoc: doc,
          inspections: doc.items.filter((it) => it.product).map((it) => ({ product: it.product, quantity: it.quantity, condition: 'GOOD' })),
          actor: req.user,
          performedByType: 'HUMAN',
        });
      } catch (e) {
        console.error('[inventory restock]', e.message);
        for (const it of doc.items) {
          if (it.product) await Product.findByIdAndUpdate(it.product, { $inc: { stock: it.quantity } });
        }
      }
      // Money-out decides the payment flag — a Processing gateway refund is NOT 'Refunded' yet.
      if (doc.order && doc.refundStatus === 'Paid') {
        await Order.findByIdAndUpdate(doc.order, { paymentStatus: 'Refunded' });
      }
    }
    // Refund attempt on Refunded (best-effort; Failed retried by cron/endpoint).
    // Paid/External/Failed are terminal-by-human — never auto-touched here.
    if (doc.type === 'SALE_RETURN' && doc.status === 'Refunded'
      && ['Pending', 'Processing'].includes(doc.refundStatus || 'Pending')) {
      try {
        const { processRefund } = await import('../services/refundService.js');
        await processRefund(doc, { actor: req.user });
      } catch (e) {
        console.error('[refund]', e.message);
      }
    }
    await doc.save();

    // Autopilot: approval → no posting; actual refund money-out → post once
    try {
      if (doc.status === 'Refunded' && doc.refundStatus === 'Paid' && !doc.journalPosted && (doc.refundAmount || 0) > 0) {
        const order = doc.order ? await Order.findById(doc.order) : null;
        await recordRefund({
          order,
          amount: doc.refundAmount,
          method: doc.refundMethod === 'Bank' ? 'BANK' : doc.refundMethod,
          reason: doc.reason || 'Return refund',
          actorId: req.user.id,
          req,
          returnRef: doc._id,
        });
        doc.journalPosted = true;
        await doc.save({ validateBeforeSave: false });
        logAudit(req, { action: 'REFUND_APPROVED', entity: 'Return', entityId: doc._id, entityName: doc.returnNumber, details: { amount: doc.refundAmount } });
      } else if (status === 'Approved') {
        logAudit(req, { action: 'REFUND_APPROVED', entity: 'Return', entityId: doc._id, entityName: doc.returnNumber, details: { stage: 'approved-pending-payment' } });
      }
    } catch (e) {
      console.error('[accounting autopilot]', e.message);
    }
    res.json({ success: true, data: doc });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

export const retryRefund = async (req, res) => {
  try {
    const doc = await Return.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Return not found' });
    if (doc.refundStatus === 'Paid') return res.json({ success: true, data: doc, message: 'Already paid' });
    const { processRefund } = await import('../services/refundService.js');
    const { outcome, error } = await processRefund(doc, { actor: req.user });
    // Money-out decides journal + order flag (same rule as updateReturnStatus).
    if (['paid', 'paid-zero', 'paid-cash'].includes(outcome) && !doc.journalPosted && (doc.refundAmount || 0) > 0) {
      await recordRefund({ order: doc.order ? await Order.findById(doc.order) : null, amount: doc.refundAmount, method: doc.refundMethod, reason: doc.reason || 'Return refund', actorId: req.user.id, req, returnRef: doc._id });
      doc.journalPosted = true;
      await doc.save({ validateBeforeSave: false });
      if (doc.order) await Order.findByIdAndUpdate(doc.order, { paymentStatus: 'Refunded' });
    }
    logAudit(req, { action: 'REFUND_APPROVED', entity: 'Return', entityId: doc._id, entityName: doc.returnNumber, details: { stage: 'manual-retry', outcome } });
    res.json({ success: true, data: doc, outcome, error });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

export const deleteReturn = async (req, res) => {
  // Financial records are immutable — no hard delete
  return res.status(403).json({
    success: false,
    message: 'Returns cannot be deleted. Reject them instead to keep the audit trail.',
  });
};

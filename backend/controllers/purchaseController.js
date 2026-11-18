import Purchase from '../models/Purchase.js';
import Product from '../models/Product.js';
import { recordPurchase, recordSupplierPayment } from '../services/accountingService.js';
import { logAudit } from '../utils/auditLog.js';

const totals = (body) => {
  const items = body.items || [];
  const subtotal = items.reduce((s, i) => s + i.quantity * i.costPrice, 0);
  const totalCost = Math.max(0, subtotal - (body.discount || 0));
  const paidAmount = body.paidAmount || 0;
  return { subtotal, totalCost, dueAmount: Math.max(0, totalCost - paidAmount) };
};

export const getPurchases = async (req, res) => {
  try {
    const { supplier, paymentStatus, page = 1, limit = 20, from, to } = req.query;
    const q = {};
    if (supplier) q.supplier = supplier;
    if (paymentStatus) q.paymentStatus = paymentStatus;
    if (from || to) q.purchaseDate = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
    const skip = (Number(page) - 1) * Number(limit);
    const [list, total] = await Promise.all([
      Purchase.find(q).populate('supplier', 'name company phone').sort({ purchaseDate: -1 }).skip(skip).limit(Number(limit)),
      Purchase.countDocuments(q),
    ]);
    res.json({ success: true, data: list, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const createPurchase = async (req, res) => {
  try {
    const t = totals(req.body);
    const doc = await Purchase.create({ ...req.body, ...t, createdBy: req.user.id, status: 'RECEIVED', receiveDate: new Date() });
    // Stock-in via Inventory Service (per-warehouse buckets, weighted-average
    // cost, movement ledger). Product.stock/costPrice synced by the service.
    try {
      const { receivePurchase } = await import('../services/inventory/purchaseReceivingService.js');
      await receivePurchase({
        purchase: doc,
        accepted: doc.items.filter((i) => i.product).map((i) => ({ product: i.product, quantity: i.quantity, costPrice: i.costPrice })),
        damaged: [],
        actor: req.user,
        performedByType: 'HUMAN',
      });
    } catch (e) {
      // Fallback: legacy direct bump so purchase flow never breaks
      console.error('[inventory receive]', e.message);
      for (const it of doc.items) {
        if (it.product) {
          await Product.findByIdAndUpdate(it.product, { $inc: { stock: it.quantity }, $set: { costPrice: it.costPrice } });
        }
      }
    }
    // Autopilot: inventory + payable journals (best-effort)
    try {
      await recordPurchase(doc, { actorId: req.user.id, req });
      doc.accountingPaid = doc.paidAmount || 0;
      await doc.save({ validateBeforeSave: false });
      logAudit(req, { action: 'PURCHASE_CREATED', entity: 'Purchase', entityId: doc._id, entityName: doc.invoiceNo || '', details: { total: doc.totalCost, paid: doc.paidAmount } });
    } catch (e) {
      console.error('[accounting autopilot]', e.message);
    }
    res.status(201).json({ success: true, data: doc });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

export const updatePurchasePayment = async (req, res) => {
  try {
    const doc = await Purchase.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Purchase not found' });
    const before = doc.paidAmount || 0;
    if (req.body.paidAmount != null) doc.paidAmount = Number(req.body.paidAmount);
    if (req.body.paymentMethod) doc.paymentMethod = req.body.paymentMethod;
    if (req.body.notes != null) doc.notes = req.body.notes;
    doc.dueAmount = Math.max(0, doc.totalCost - doc.paidAmount);
    doc.paymentStatus = doc.dueAmount === 0 && doc.totalCost > 0 ? 'Paid' : doc.paidAmount > 0 ? 'Partial' : 'Unpaid';
    await doc.save();
    // Autopilot: post only the NEWLY paid delta (delta-aware, idempotent-ish)
    try {
      const delta = Math.max(0, (doc.paidAmount || 0) - Math.max(before, doc.accountingPaid || 0));
      if (delta > 0) {
        await recordSupplierPayment(doc, { amount: delta, method: req.body.paymentMethod || doc.paymentMethod, actorId: req.user.id, req });
      }
    } catch (e) {
      console.error('[accounting autopilot]', e.message);
    }
    res.json({ success: true, data: doc });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

export const deletePurchase = async (req, res) => {
  // Financial history is immutable — no hard delete
  return res.status(403).json({
    success: false,
    message: 'Purchases cannot be deleted (financial history). Adjust via payments instead.',
  });
};

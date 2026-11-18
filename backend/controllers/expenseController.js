import Expense from '../models/Expense.js';
import { recordExpense } from '../services/accountingService.js';
import { voidJournal } from '../services/journalService.js';
import Journal from '../models/Journal.js';
import { logAudit } from '../utils/auditLog.js';

export const getExpenses = async (req, res) => {
  try {
    const { category, page = 1, limit = 20, from, to } = req.query;
    const q = {};
    if (category) q.category = category;
    if (from || to) q.expenseDate = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
    const skip = (Number(page) - 1) * Number(limit);
    const [list, total] = await Promise.all([
      Expense.find(q).sort({ expenseDate: -1 }).skip(skip).limit(Number(limit)),
      Expense.countDocuments(q),
    ]);
    res.json({ success: true, data: list, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const createExpense = async (req, res) => {
  try {
    const doc = await Expense.create({ ...req.body, createdBy: req.user.id });
    // Autopilot: post expense journal (best-effort, never breaks create)
    try {
      await recordExpense(doc, { actorId: req.user.id, req });
      logAudit(req, { action: 'EXPENSE_CREATED', entity: 'Expense', entityId: doc._id, entityName: doc.title, details: { amount: doc.amount, category: doc.category } });
    } catch (e) {
      console.error('[accounting autopilot]', e.message);
    }
    res.status(201).json({ success: true, data: doc });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

export const updateExpense = async (req, res) => {
  try {
    const { status, ...fields } = req.body;
    const doc = await Expense.findByIdAndUpdate(req.params.id, fields, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Expense not found' });
    if (doc.status === 'VOIDED') {
      return res.status(400).json({ success: false, message: 'Voided expenses cannot be edited' });
    }
    res.json({ success: true, data: doc });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

// @desc    Void expense (reversal journal; NO hard delete)
// @route   PATCH /api/expenses/:id/void
// @access  Private
export const voidExpense = async (req, res) => {
  try {
    const { reason = '' } = req.body;
    const doc = await Expense.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Expense not found' });
    if (doc.status === 'VOIDED') return res.status(400).json({ success: false, message: 'Already voided' });

    const journal = await Journal.findOne({ refKey: `EXPENSE:Expense:${doc._id}:MAIN` });
    if (journal && journal.status === 'POSTED') {
      await voidJournal(journal._id, { by: req.user.id, reason: reason || 'Expense voided' });
    }
    doc.status = 'VOIDED';
    doc.voidReason = reason;
    doc.voidedBy = req.user.id;
    doc.voidedAt = new Date();
    await doc.save({ validateBeforeSave: false });

    logAudit(req, { action: 'EXPENSE_VOIDED', entity: 'Expense', entityId: doc._id, entityName: doc.title, details: { amount: doc.amount, reason } });
    res.json({ success: true, message: 'Expense voided (reversal posted)', data: doc });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

export const deleteExpense = async (req, res) => {
  // Hard delete is forbidden for financial records — void instead
  return res.status(403).json({
    success: false,
    message: 'Expenses cannot be deleted. Void them instead (keeps audit trail).',
  });
};

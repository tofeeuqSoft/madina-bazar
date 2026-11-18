import mongoose from 'mongoose';
import Journal from '../models/Journal.js';
import LedgerLine from '../models/LedgerLine.js';
import { ensureChartOfAccounts, getAccountOrThrow } from './chartOfAccounts.js';

let voucherSeq = 0;
const nextVoucherNo = () => {
  voucherSeq = (voucherSeq + 1) % 100000;
  return `JV${Date.now().toString().slice(-8)}${String(voucherSeq).padStart(3, '0')}`;
};

/**
 * Post a balanced journal + ledger lines (the accounting engine core).
 * - Validates Dr === Cr (throws otherwise — caller must handle)
 * - Idempotent: same refKey returns existing journal (no duplicates)
 * - Ordered writes (Journal → LedgerLines) for standalone MongoDB
 *   (no replica-set transactions); failures are audit-logged by callers
 *   and backfilled by the repair endpoint.
 *
 * entries: [{ accountCode, debit?, credit?, narration? }]
 */
export const postJournal = async ({
  date,
  module,
  referenceType = '',
  referenceId = '',
  kind = 'MAIN',
  narration = '',
  entries = [],
  actorId,
}) => {
  if (!module) throw new Error('Journal module is required');
  if (!Array.isArray(entries) || entries.length < 2) {
    throw new Error('Journal needs at least 2 entries');
  }

  await ensureChartOfAccounts();

  const refKey =
    referenceType && referenceId ? `${module}:${referenceType}:${referenceId}:${kind}` : undefined;

  if (refKey) {
    const existing = await Journal.findOne({ refKey });
    if (existing) return { journal: existing, created: false };
  }

  const legs = [];
  for (const e of entries) {
    const acc = await getAccountOrThrow(e.accountCode);
    const debit = Math.round((Number(e.debit) || 0) * 100) / 100;
    const credit = Math.round((Number(e.credit) || 0) * 100) / 100;
    if (debit < 0 || credit < 0) throw new Error('Negative amounts not allowed');
    if (debit > 0 && credit > 0) throw new Error('A leg cannot be both debit and credit');
    if (debit === 0 && credit === 0) continue;
    legs.push({ account: acc._id, code: acc.code, name: acc.name, debit, credit, narration: e.narration || narration });
  }
  if (legs.length < 2) throw new Error('Journal needs at least 2 non-zero entries');

  const journal = await Journal.create({
    voucherNo: nextVoucherNo(),
    date: date || new Date(),
    module,
    referenceType,
    referenceId: String(referenceId || ''),
    refKey,
    narration,
    entries: legs,
    createdBy: actorId,
  });

  // Ledger lines with running balances (per account, chronological)
  for (const leg of legs) {
    const last = await LedgerLine.findOne({ account: leg.account }).sort({ date: -1, _id: -1 }).lean();
    const prev = last?.balanceAfter || 0;
    const acc = await getAccountOrThrow(leg.code);
    const normalDebit = ['Asset', 'Expense'].includes(acc.type) || leg.code === 'SALES_RETURNS';
    const delta = normalDebit ? leg.debit - leg.credit : leg.credit - leg.debit;
    await LedgerLine.create({
      journal: journal._id,
      voucherNo: journal.voucherNo,
      date: journal.date,
      account: leg.account,
      code: leg.code,
      debit: leg.debit,
      credit: leg.credit,
      balanceAfter: Math.round((prev + delta) * 100) / 100,
      referenceType,
      referenceId: String(referenceId || ''),
      narration: leg.narration,
    });
  }

  return { journal, created: true };
};

/**
 * Void a journal via mirror reversal (original stays immutable).
 */
export const voidJournal = async (journalId, { by, reason = '' } = {}) => {
  const original = await Journal.findById(journalId);
  if (!original) throw new Error('Journal not found');
  if (original.status === 'VOIDED') throw new Error('Already voided');

  const mirror = original.entries.map((e) => ({
    accountCode: e.code,
    debit: e.credit,
    credit: e.debit,
    narration: `Reversal of ${original.voucherNo}${reason ? ` — ${reason}` : ''}`,
  }));

  const { journal: reversal } = await postJournal({
    date: new Date(),
    module: original.module,
    referenceType: original.referenceType,
    referenceId: original.referenceId,
    kind: `VOID:${original._id}`,
    narration: `Reversal of ${original.voucherNo}${reason ? ` — ${reason}` : ''}`,
    entries: mirror,
    actorId: by,
  });

  original.status = 'VOIDED';
  original.void = { by, at: new Date(), reason, reversalRef: reversal.voucherNo };
  await original.save();

  return { original, reversal };
};

/**
 * IDs of journals that count in statements: POSTED and not a VOID pair.
 * (A voided original + its reversal cancel out — both are excluded so
 * statements never show phantom profit/loss from voided activity.
 * The full trail stays visible in Ledger/Journals views + audit.)
 */
export const activeJournalIds = async () => {
  const docs = await Journal.find({
    status: 'POSTED',
    $nor: [{ kind: /^VOID:/ }],
  })
    .select('_id')
    .lean();
  return docs.map((d) => d._id);
};

export const accountBalance = async (accountCode) => {  const last = await LedgerLine.findOne({ code: String(accountCode).toUpperCase() })
    .sort({ date: -1, _id: -1 })
    .lean();
  return last?.balanceAfter || 0;
};

export const trialBalance = async ({ from, to } = {}) => {
  const match = {};
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(to);
  }
  const rows = await LedgerLine.aggregate([
    { $match: match },
    { $group: { _id: '$code', debit: { $sum: '$debit' }, credit: { $sum: '$credit' } } },
    { $sort: { _id: 1 } },
  ]);
  const totals = rows.reduce(
    (s, r) => ({ debit: s.debit + r.debit, credit: s.credit + r.credit }),
    { debit: 0, credit: 0 }
  );
  return { rows, totals, balanced: Math.abs(totals.debit - totals.credit) < 0.01 };
};

export default { postJournal, voidJournal, activeJournalIds, accountBalance, trialBalance };

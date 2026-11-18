import mongoose from 'mongoose';

// Materialized ledger lines (one per journal entry leg).
// balanceAfter = running balance of the account right after this line.
// Written in the same unit of work as the Journal (see journalService;
// standalone MongoDB has no multi-doc transactions — writes are ordered
// Journal-first and idempotent via refKey, with a repair endpoint).
const ledgerLineSchema = new mongoose.Schema(
  {
    journal: { type: mongoose.Schema.Types.ObjectId, ref: 'Journal', required: true },
    voucherNo: { type: String, default: '' },
    date: { type: Date, default: Date.now },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountingAccount', required: true },
    code: { type: String, required: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    balanceAfter: { type: Number, default: 0 },
    referenceType: { type: String, default: '' },
    referenceId: { type: String, default: '' },
    narration: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ledgerLineSchema.index({ account: 1, date: 1, _id: 1 });
ledgerLineSchema.index({ code: 1, date: -1 });
ledgerLineSchema.index({ referenceType: 1, referenceId: 1 });

const LedgerLine = mongoose.model('LedgerLine', ledgerLineSchema);
export default LedgerLine;

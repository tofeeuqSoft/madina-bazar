import mongoose from 'mongoose';

// Double-entry journal header. Entries embedded for atomicity.
// Every journal MUST balance: totalDebit === totalCredit.
// Idempotency: refKey unique (module:refType:refId:kind).
const journalEntrySchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountingAccount', required: true },
    code: { type: String, required: true },
    name: { type: String, default: '' },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    narration: { type: String, default: '' },
  },
  { _id: false }
);

const journalSchema = new mongoose.Schema(
  {
    voucherNo: { type: String, unique: true, required: true },
    date: { type: Date, default: Date.now },
    module: {
      type: String,
      enum: ['SALE', 'PAYMENT', 'EXPENSE', 'PURCHASE', 'REFUND', 'TRANSFER', 'TAX', 'ADJUSTMENT'],
      required: true,
    },
    referenceType: { type: String, default: '' }, // Order | Payment | Expense | ...
    referenceId: { type: String, default: '' },
    refKey: { type: String, unique: true, sparse: true },
    kind: { type: String, default: 'MAIN' }, // MAIN | VOID:<originalId> | SUPPAY:<ts>
    narration: { type: String, default: '' },
    entries: { type: [journalEntrySchema], validate: [(v) => v && v.length >= 2, 'Min 2 entries'] },
    totalDebit: { type: Number, default: 0 },
    totalCredit: { type: Number, default: 0 },
    status: { type: String, enum: ['POSTED', 'VOIDED'], default: 'POSTED' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    void: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: Date,
      reason: { type: String, default: '' },
      reversalRef: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

journalSchema.pre('validate', function (next) {
  const d = (this.entries || []).reduce((s, e) => s + (Number(e.debit) || 0), 0);
  const c = (this.entries || []).reduce((s, e) => s + (Number(e.credit) || 0), 0);
  this.totalDebit = Math.round(d * 100) / 100;
  this.totalCredit = Math.round(c * 100) / 100;
  if (Math.abs(this.totalDebit - this.totalCredit) > 0.009) {
    return next(new Error(`Journal out of balance: Dr ${this.totalDebit} vs Cr ${this.totalCredit}`));
  }
  next();
});

journalSchema.index({ date: -1 });
journalSchema.index({ module: 1, date: -1 });
journalSchema.index({ status: 1 });

const Journal = mongoose.model('Journal', journalSchema);
export default Journal;

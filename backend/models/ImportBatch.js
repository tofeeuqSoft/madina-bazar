import mongoose from 'mongoose';

// CSV import batch — validate → confirm → (rollback if needed).
// Rollback never deletes: created products are deactivated, updated ones
// restored to snapshots. Full audit trail preserved.
const importRowSchema = new mongoose.Schema(
  {
    rowNumber: { type: Number, required: true },
    sku: { type: String, default: '' },
    action: { type: String, enum: ['CREATE', 'UPDATE', 'SKIPPED'], required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    oldValues: { type: mongoose.Schema.Types.Mixed, default: null },
    newValues: { type: mongoose.Schema.Types.Mixed, default: null },
    warnings: [{ type: String }],
  },
  { _id: false }
);

const importBatchSchema = new mongoose.Schema(
  {
    batchId: { type: String, unique: true, required: true },
    fileName: { type: String, default: '' },
    status: { type: String, enum: ['VALIDATED', 'CONFIRMED', 'ROLLED_BACK'], default: 'VALIDATED' },
    totalRows: { type: Number, default: 0 },
    okRows: { type: Number, default: 0 },
    errorRows: { type: Number, default: 0 },
    rowErrors: [{ rowNumber: Number, message: String }],
    rows: [importRowSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

importBatchSchema.pre('validate', async function (next) {
  if (this.isNew && !this.batchId) {
    const count = await mongoose.model('ImportBatch').countDocuments();
    this.batchId = `IMP${Date.now().toString().slice(-8)}${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

importBatchSchema.index({ status: 1, createdAt: -1 });

const ImportBatch = mongoose.model('ImportBatch', importBatchSchema);
export default ImportBatch;

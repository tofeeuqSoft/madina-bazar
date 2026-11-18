import mongoose from 'mongoose';

// Persistent job queue — survives server restarts (unlike in-memory retries).
// Workers claim due jobs atomically; idempotencyKey prevents double execution.
const jobSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['COURIER_CREATE', 'COURIER_RETRY', 'TRACKING_SYNC', 'COURIER_CANCEL', 'NOTIFY'],
      required: true,
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    idempotencyKey: { type: String, default: '' },
    status: { type: String, enum: ['PENDING', 'RUNNING', 'DONE', 'FAILED'], default: 'PENDING' },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    runAt: { type: Date, default: Date.now },
    lastError: { type: String, default: '' },
  },
  { timestamps: true }
);

jobSchema.index({ status: 1, runAt: 1 });
jobSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

const Job = mongoose.model('Job', jobSchema);
export default Job;

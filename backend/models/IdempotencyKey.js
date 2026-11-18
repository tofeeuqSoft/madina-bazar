import mongoose from 'mongoose';

// Checkout idempotency: one clientKey = at most one order, even across
// double-taps, retries and multi-instance races. Unique index is the lock;
// IN_PROGRESS with a stale-timeout covers crashed workers; COMPLETED replays
// the same order without touching stock/coupon/cart again.
const idempotencyKeySchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['IN_PROGRESS', 'COMPLETED', 'FAILED'], default: 'IN_PROGRESS' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    orderNumber: { type: String, default: '' },
    // Auto-cleanup after 24h (TTL) — keys are single-use per checkout attempt.
    expiresAt: { type: Date, default: () => new Date(Date.now() + 86400000) },
  },
  { timestamps: true }
);

idempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
idempotencyKeySchema.index({ user: 1, createdAt: -1 });

const IdempotencyKey = mongoose.model('IdempotencyKey', idempotencyKeySchema);
export default IdempotencyKey;

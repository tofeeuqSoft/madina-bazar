import mongoose from 'mongoose';

// Per-shipment COD handover: expected vs collected vs submitted.
// Any negative variance forces ADMIN_REVIEW before settlement.
const riderCODCollectionSchema = new mongoose.Schema(
  {
    shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', required: true },
    expectedAmount: { type: Number, required: true, min: 0 },
    collectedAmount: { type: Number, default: 0, min: 0 },
    submittedAmount: { type: Number, default: 0, min: 0 },
    variance: { type: Number, default: 0 },
    status: { type: String, enum: ['PENDING', 'SUBMITTED', 'REVIEW', 'SETTLED'], default: 'PENDING' },
    settledAt: { type: Date, default: null },
    shortageAbsorbed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

riderCODCollectionSchema.pre('validate', function (next) {
  this.variance = (this.submittedAmount || 0) - (this.expectedAmount || 0);
  // Terminal SETTLED is never auto-reverted — settlement is final.
  if (this.status !== 'SETTLED' && this.submittedAmount > 0 && this.variance < 0) this.status = 'REVIEW';
  next();
});

riderCODCollectionSchema.index({ rider: 1, status: 1 });
riderCODCollectionSchema.index({ shipment: 1 }, { unique: true });

const RiderCODCollection = mongoose.model('RiderCODCollection', riderCODCollectionSchema);
export default RiderCODCollection;

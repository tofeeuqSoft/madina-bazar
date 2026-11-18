import mongoose from 'mongoose';

// Rider pay for a period — compensation model is configurable, and earnings
// NEVER mix with customer delivery charges (separate accounting concern).
const riderSettlementSchema = new mongoose.Schema(
  {
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', required: true },
    periodFrom: { type: Date, required: true },
    periodTo: { type: Date, required: true },
    model: { type: String, enum: ['FIXED_SALARY', 'PER_DELIVERY', 'ZONE_BASED', 'MIXED'], required: true },
    deliveries: { type: Number, default: 0, min: 0 },
    baseAmount: { type: Number, default: 0, min: 0 },
    perDeliveryRate: { type: Number, default: 0, min: 0 },
    incentive: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
    codVariance: { type: Number, default: 0 },
    status: { type: String, enum: ['DRAFT', 'APPROVED', 'PAID'], default: 'DRAFT' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

riderSettlementSchema.index({ rider: 1, periodFrom: -1 });

const RiderSettlement = mongoose.model('RiderSettlement', riderSettlementSchema);
export default RiderSettlement;

import mongoose from 'mongoose';

// Singleton free-delivery rule (one active doc; latest wins).
// Coupon system stays separate — this is delivery only.
const freeDeliveryRuleSchema = new mongoose.Schema(
  {
    isActive: {
      type: Boolean,
      default: false,
    },
    minimumOrderAmount: {
      type: Number,
      default: 1000,
      min: 0,
    },
    applicableTo: {
      type: String,
      enum: ['ALL', 'GROCERY', 'NATIONWIDE'],
      default: 'ALL',
    },
  },
  { timestamps: true }
);

const FreeDeliveryRule = mongoose.model('FreeDeliveryRule', freeDeliveryRuleSchema);
export default FreeDeliveryRule;

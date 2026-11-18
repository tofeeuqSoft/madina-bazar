import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minimumOrderAmount: {
      type: Number,
      default: 0,
    },
    maximumDiscount: {
      type: Number, // for percentage coupons
    },
    expiryDate: {
      type: Date,
    },
    // Schedule window (null = always within active flag)
    startDate: {
      type: Date,
      default: null,
    },
    // Targeting (empty = whole cart — backward compatible)
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    usageLimit: {
      type: Number, // total times it can be used
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    // Per-user cap (null/0 = unlimited — preserves legacy behavior).
    // Prevents one customer from reusing a generous code forever.
    maxPerUser: {
      type: Number,
      default: null,
      min: 1,
    },
    usedBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        count: { type: Number, default: 0 },
        _id: false,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon;

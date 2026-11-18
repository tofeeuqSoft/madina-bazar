import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    verifiedPurchase: {
      type: Boolean,
      default: false,
    },
    // Moderation: PENDING reviews are hidden from storefront until approved
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'APPROVED', // existing reviews stay visible (migration-safe)
    },
  },
  { timestamps: true }
);

// One review per customer per product (update instead of duplicate)
reviewSchema.index({ product: 1, user: 1 }, { unique: true });
reviewSchema.index({ product: 1, createdAt: -1 });

const Review = mongoose.model('Review', reviewSchema);
export default Review;

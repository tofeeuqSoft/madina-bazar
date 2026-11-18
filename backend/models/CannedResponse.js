import mongoose from 'mongoose';

const cannedResponseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Canned response name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    // The actual response text (can include variables like {customer_name}, {order_id})
    template: {
      type: String,
      required: true,
    },
    // Category for organization
    category: {
      type: String,
      enum: [
        'REFUND',
        'RETURN',
        'DELIVERY',
        'PAYMENT',
        'CANCEL',
        'ORDER_STATUS',
        'GENERAL',
      ],
      required: true,
    },
    // AI-ready: approval status for AI usage
    isApprovedForAI: {
      type: Boolean,
      default: false,
    },
    // Usage tracking
    usageCount: {
      type: Number,
      default: 0,
    },
    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    // Ownership
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
cannedResponseSchema.index({ category: 1, isActive: 1 });

const CannedResponse = mongoose.model('CannedResponse', cannedResponseSchema);
export default CannedResponse;
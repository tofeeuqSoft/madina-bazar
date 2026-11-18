import mongoose from 'mongoose';

const customerFeedbackSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportTicket',
    },
    conversation: {
      type: String,
      // conversationId
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Rating
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    // Optional feedback text
    comment: {
      type: String,
      trim: true,
    },
    // Which part of support was rated
    ratedAspect: {
      type: String,
      enum: ['AGENT', 'AI', 'RESOLUTION', 'RESPONSE_TIME', 'OVERALL'],
      default: 'OVERALL',
    },
    // AI-specific rating
    aiRating: {
      type: Boolean,
      default: false,
    },

    // Timestamps
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
customerFeedbackSchema.index({ customer: 1, createdAt: -1 });
customerFeedbackSchema.index({ ticket: 1 });

const CustomerFeedback = mongoose.model('CustomerFeedback', customerFeedbackSchema);
export default CustomerFeedback;
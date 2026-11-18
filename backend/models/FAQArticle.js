import mongoose from 'mongoose';

const faqArticleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Article title is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    category: {
      type: String,
      enum: [
        'ORDERS',
        'PAYMENTS',
        'DELIVERY',
        'RETURNS',
        'REFUNDS',
        'PRODUCTS',
        'ACCOUNT',
        'GROCERY',
        'NATIONWIDE_DELIVERY',
      ],
      required: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    // Content in markdown or rich text
    content: {
      type: String,
      required: true,
    },
    // AI-ready fields
    version: {
      type: Number,
      default: 1,
    },
    // For RAG/vector database integration
    embeddingId: {
      type: String,
      default: null,
    },
    // Metadata
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

// Indexes for search
faqArticleSchema.index({ title: 'text', content: 'text', tags: 1, category: 1 });
faqArticleSchema.index({ category: 1, isActive: 1 });

const FAQArticle = mongoose.model('FAQArticle', faqArticleSchema);
export default FAQArticle;
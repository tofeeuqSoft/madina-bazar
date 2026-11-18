import mongoose from 'mongoose';

const supportCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: '',
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportCategory',
    },
    // AI-ready: for knowledge base routing
    aiPriority: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },

    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
supportCategorySchema.index({ parent: 1, isActive: 1 });
supportCategorySchema.index({ sortOrder: 1 });

const SupportCategory = mongoose.model('SupportCategory', supportCategorySchema);
export default SupportCategory;
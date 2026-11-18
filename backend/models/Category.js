import mongoose from 'mongoose';
import slugify from 'slugify';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    slug: {
      type: String,
      lowercase: true,
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    // Default product type for products under this category
    // (auto-maintained from tree position — no manual types)
    type: {
      type: String,
      uppercase: true,
      trim: true,
      default: 'GROCERY',
    },
    image: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    // Buyer lead time (days) for restock forecast; null = global default
    leadTimeDays: {
      type: Number,
      min: 1,
      max: 90,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Auto generate slug
categorySchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// Virtual for children
categorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentCategory',
});

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parentCategory: 1, isActive: 1 });
categorySchema.index({ isActive: 1, displayOrder: 1 });

const Category = mongoose.model('Category', categorySchema);
export default Category;

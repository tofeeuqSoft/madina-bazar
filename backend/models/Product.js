import mongoose from 'mongoose';
import slugify from 'slugify';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    slug: {
      type: String,
      lowercase: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
    productType: {
      type: String,
      uppercase: true,
      trim: true,
      default: 'GROCERY',
    },
    // Grocery scope flag (from upload scope selector) — drives zone/area rules.
    // Stored on product so reports/orders never depend on renames.
    isGrocery: {
      type: Boolean,
      default: false,
    },
    brand: {
      type: String,
      default: '',
    },
    sku: {
      type: String,
      unique: true,
      sparse: true,
    },
    regularPrice: {
      type: Number,
      required: [true, 'Regular price is required'],
      min: 0,
    },
    saleSchedule: {
      price: { type: Number, min: 0, default: null },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      preSale: { type: Number, default: null },
      lastApplied: { type: Date, default: null },
    },
    salePrice: {
      type: Number,
      min: 0,
    },
    costPrice: {
      type: Number,
      min: 0,
      default: 0, // purchase cost — used for COGS / inventory valuation / profit
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    minStock: {
      type: Number,
      default: 5, // for low stock alert
    },
    // BD VAT: unprocessed agri/grocery essentials are typically VAT-exempt.
    // Exempt lines are excluded from the VAT base (pro-rata discount split).
    vatExempt: {
      type: Boolean,
      default: false,
    },
    unit: {
      type: String,
      enum: ['KG', 'Gram', 'Piece', 'Packet', 'Liter', 'ML', 'Box', 'Dozen'],
      default: 'Piece',
    },
    // Optional variants (e.g. clothing: sizes M/L/XL, colors Red/Blue).
    // Grocery items usually leave these empty.
    sizes: {
      type: [String],
      default: [],
    },
    colors: {
      type: [
        {
          name: { type: String, required: true, trim: true },
          code: { type: String, default: '' }, // hex swatch, e.g. #ff0000
          _id: false,
        },
      ],
      default: [],
    },
    videos: [
      {
        url: String,
        publicId: String,
        provider: String,
      },
    ],
    images: [
      {
        url: String,
        isMain: { type: Boolean, default: false },
        // Provider-agnostic tag (auto-detected from URL, display does not depend on it)
        provider: { type: String, default: 'auto' },
      },
    ],
    description: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    soldCount: {
      type: Number,
      default: 0,
    },
    // Denormalized rating (updated on review create/update/delete)
    ratingAvg: {
      type: Number,
      default: 0,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Auto generate slug
productSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// Virtual for discount percentage
productSchema.virtual('discountPercent').get(function () {
  if (this.salePrice && this.regularPrice > this.salePrice) {
    return Math.round(((this.regularPrice - this.salePrice) / this.regularPrice) * 100);
  }
  return 0;
});

// Performance indexes
productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ isActive: 1, isFeatured: 1 });
productSchema.index({ productType: 1, isActive: 1 });
productSchema.index({ salePrice: 1 });
productSchema.index({ stock: 1 });
productSchema.index({ name: 'text', description: 'text', brand: 'text', sku: 'text' });
productSchema.index({ createdAt: -1 });

const Product = mongoose.model('Product', productSchema);
export default Product;

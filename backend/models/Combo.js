import mongoose from 'mongoose';
import slugify from 'slugify';

const comboItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
});

const comboSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Combo name is required'],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    items: [comboItemSchema],
    regularPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    salePrice: {
      type: Number,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0, // percentage or fixed
    },
    images: [
      {
        url: String,
        isMain: { type: Boolean, default: false },
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
  },
  { timestamps: true }
);

comboSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

const Combo = mongoose.model('Combo', comboSchema);
export default Combo;

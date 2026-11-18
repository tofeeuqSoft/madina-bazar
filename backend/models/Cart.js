import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  },
  combo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Combo',
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  // Selected variant (optional — only for products that define sizes/colors)
  size: { type: String, default: '' },
  color: { type: String, default: '' },
  colorCode: { type: String, default: '' },
});

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    items: [cartItemSchema],
  },
  { timestamps: true }
);

const Cart = mongoose.model('Cart', cartSchema);
export default Cart;

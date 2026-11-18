import mongoose from 'mongoose';

const deliveryAreaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Area name is required'],
      trim: true,
    },
    city: {
      type: String,
      default: 'Dhaka',
    },
    parentArea: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryArea',
      default: null,
    },
    deliveryCharge: {
      type: Number,
      required: true,
      min: 0,
      default: 60,
    },
    minimumOrderAmount: {
      type: Number,
      default: 0,
    },
    estimatedDeliveryTime: {
      type: String,
      default: '2-4 Hours',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Grocery scope: true = GROCERY products deliverable here (e.g. Mirpur).
    // Non-grocery (Ready-to-Cook, Combo, Other) delivers to ALL active areas.
    // Admin expands grocery coverage by enabling this on more areas.
    groceryDelivery: {
      type: Boolean,
      default: false,
    },
    // Admin-written note shown on Grocery pages
    // e.g. "Only Mirpur available" / custom per-area message
    deliveryNote: {
      type: String,
      default: '',
      maxlength: 300,
    },
    // For Barikoi integration later
    barikoiAreaId: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

const DeliveryArea = mongoose.model('DeliveryArea', deliveryAreaSchema);
export default DeliveryArea;

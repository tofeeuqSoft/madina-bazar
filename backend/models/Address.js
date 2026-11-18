import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    label: {
      type: String,
      default: 'Home', // Home / Office / Other
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    area: String,
    city: {
      type: String,
      default: 'Dhaka',
    },
    postcode: {
      type: String,
      default: '',
    },
    deliveryArea: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryArea',
    },
    // Barikoi fields (ID-based matching — never names)
    latitude: Number,
    longitude: Number,
    placeId: String,
    uCode: {
      type: String,
      default: '',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Address = mongoose.model('Address', addressSchema);
export default Address;

import mongoose from 'mongoose';

// Nationwide (non-grocery) fixed charge per district.
// District match is case-insensitive; unknown → 'Other' row.
const nationwideDeliveryChargeSchema = new mongoose.Schema(
  {
    district: {
      type: String,
      required: [true, 'District is required'],
      unique: true,
      trim: true,
    },
    charge: {
      type: Number,
      required: true,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const NationwideDeliveryCharge = mongoose.model(
  'NationwideDeliveryCharge',
  nationwideDeliveryChargeSchema
);
export default NationwideDeliveryCharge;

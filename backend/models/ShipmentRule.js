import mongoose from 'mongoose';

// Shipment rule (singleton). Only SINGLE_SHIPMENT is implemented:
// mixed carts pay MAX(grocery, nationwide); free delivery → 0.
const shipmentRuleSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ['SINGLE_SHIPMENT'],
      default: 'SINGLE_SHIPMENT',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const ShipmentRule = mongoose.model('ShipmentRule', shipmentRuleSchema);
export default ShipmentRule;

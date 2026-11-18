import mongoose from 'mongoose';

const stockReservationSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantKey: { type: String, default: '' },
    sku: { type: String, default: '' },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    quantity: { type: Number, required: true, min: 1 },
    size: { type: String, default: '' },
    color: { type: String, default: '' },
    referenceType: { type: String, default: 'ORDER' },
    referenceId: { type: String, required: true }, // orderNumber / operation id
    status: { type: String, enum: ['ACTIVE', 'CONFIRMED', 'RELEASED'], default: 'ACTIVE' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    releasedAt: { type: Date, default: null },
    // Stuck holds auto-release via sweep — stock can never lock forever.
    expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 60000) },
  },
  { timestamps: true }
);

stockReservationSchema.index({ referenceType: 1, referenceId: 1, status: 1 });
stockReservationSchema.index({ product: 1, warehouse: 1, status: 1 });
stockReservationSchema.index({ status: 1, expiresAt: 1 });

const StockReservation = mongoose.model('StockReservation', stockReservationSchema);
export default StockReservation;

import mongoose from 'mongoose';

const warehouseSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Warehouse name is required'], trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    address: { type: String, default: '' },
    district: { type: String, default: '' },
    contactPerson: { type: String, default: '' },
    phone: { type: String, default: '' },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'], default: 'ACTIVE' },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

warehouseSchema.index({ status: 1 });

const Warehouse = mongoose.model('Warehouse', warehouseSchema);
export default Warehouse;

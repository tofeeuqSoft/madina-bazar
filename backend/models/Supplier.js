import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Supplier name is required'], trim: true },
    company: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    email: { type: String, default: '', lowercase: true, trim: true },
    address: { type: String, default: '' },
    openingDue: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

supplierSchema.index({ name: 'text', company: 'text', phone: 'text' });
supplierSchema.index({ isActive: 1 });

const Supplier = mongoose.model('Supplier', supplierSchema);
export default Supplier;

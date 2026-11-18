import mongoose from 'mongoose';

const purchaseItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  costPrice: { type: Number, required: true, min: 0 },
});

const purchaseSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, unique: true, sparse: true, trim: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    items: [purchaseItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ['Unpaid', 'Partial', 'Paid'],
      default: 'Unpaid',
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Bank', 'BKASH', 'NAGAD', 'SSLCOMMERZ', 'Other'],
      default: 'Cash',
    },
    purchaseDate: { type: Date, default: Date.now },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Receiving + accounting markers (no hard delete of financial history)
    status: {
      type: String,
      enum: ['DRAFT', 'RECEIVED', 'RETURNED'],
      default: 'RECEIVED',
    },
    receiveDate: Date,
    // How much supplier-payment journal has been posted against paidAmount
    accountingPaid: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

purchaseSchema.pre('validate', function (next) {
  const sub = this.items?.reduce((s, i) => s + i.quantity * i.costPrice, 0) || 0;
  if (!this.subtotal) this.subtotal = sub;
  if (this.totalCost == null) this.totalCost = Math.max(0, this.subtotal - (this.discount || 0));
  this.dueAmount = Math.max(0, this.totalCost - (this.paidAmount || 0));
  if (this.dueAmount === 0 && this.totalCost > 0) this.paymentStatus = 'Paid';
  else if ((this.paidAmount || 0) > 0) this.paymentStatus = 'Partial';
  else this.paymentStatus = 'Unpaid';
  next();
});

purchaseSchema.index({ supplier: 1, purchaseDate: -1 });
purchaseSchema.index({ paymentStatus: 1 });
purchaseSchema.index({ purchaseDate: -1 });

const Purchase = mongoose.model('Purchase', purchaseSchema);
export default Purchase;

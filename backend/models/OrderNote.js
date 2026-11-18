import mongoose from 'mongoose';

const orderNoteSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    visibility: { type: String, enum: ['INTERNAL', 'CUSTOMER'], required: true, default: 'INTERNAL' },
    content: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

orderNoteSchema.index({ order: 1, visibility: 1, createdAt: -1 });

const OrderNote = mongoose.model('OrderNote', orderNoteSchema);
export default OrderNote;

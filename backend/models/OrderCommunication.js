import mongoose from 'mongoose';

const orderCommunicationSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: String, default: '' }, // phone/email snapshot
    channel: { type: String, enum: ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'], default: 'IN_APP' },
    message: { type: String, required: true },
    status: { type: String, enum: ['QUEUED', 'SENT', 'DELIVERED', 'FAILED'], default: 'SENT' },
    // Link to support conversation when routed through support module (no duplicate chat)
    supportTicket: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket', default: null },
  },
  { timestamps: true }
);

orderCommunicationSchema.index({ order: 1, createdAt: -1 });

const OrderCommunication = mongoose.model('OrderCommunication', orderCommunicationSchema);
export default OrderCommunication;

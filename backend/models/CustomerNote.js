import mongoose from 'mongoose';

// Internal notes — NEVER visible to customer, NEVER auto-fed to AI context.
// Future AI access requires explicit tool permission.
const customerNoteSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket', default: null },
    conversationId: { type: String, default: null },
    content: { type: String, required: true },
    isPinned: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

customerNoteSchema.index({ customer: 1, createdAt: -1 });
customerNoteSchema.index({ ticket: 1, createdAt: -1 });

const CustomerNote = mongoose.model('CustomerNote', customerNoteSchema);
export default CustomerNote;

import mongoose from 'mongoose';

// Single chat message inside a Conversation (Socket.IO room = conversationId).
// senderType keeps HUMAN_AGENT + future AI_AGENT on the same infrastructure.
const chatMessageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    conversationId: { type: String, required: true, index: true },
    senderType: {
      type: String,
      enum: ['CUSTOMER', 'HUMAN_AGENT', 'AI_AGENT', 'SYSTEM'],
      required: true,
    },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    messageType: { type: String, enum: ['TEXT', 'IMAGE', 'FILE', 'SYSTEM'], default: 'TEXT' },
    content: { type: String, required: true },
    mediaUrl: { type: String, default: null },
    mediaName: { type: String, default: null },
    // Delivery receipts
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    // AI metadata (null for human messages)
    intent: { type: String, default: null },
    confidence: { type: Number, min: 0, max: 1, default: null },
    toolUsed: { type: String, default: null },
    escalated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

chatMessageSchema.index({ conversation: 1, createdAt: 1 });
chatMessageSchema.index({ conversationId: 1, createdAt: 1 });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
export default ChatMessage;

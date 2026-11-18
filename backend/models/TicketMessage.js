import mongoose from 'mongoose';

const ticketMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportTicket',
    },
    senderType: {
      type: String,
      enum: ['CUSTOMER', 'HUMAN_AGENT', 'AI_AGENT', 'SYSTEM'],
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // null for AI_AGENT and SYSTEM messages
      default: null,
    },
    messageType: {
      type: String,
      enum: ['TEXT', 'IMAGE', 'FILE', 'SYSTEM'],
      required: true,
      default: 'TEXT',
    },
    content: {
      type: String,
      required: true,
    },
    // For media attachments
    mediaUrl: {
      type: String,
      default: null,
    },
    mediaName: {
      type: String,
      default: null,
    },
    mediaSize: {
      type: Number,
      default: null,
    },

    // AI metadata
    intent: {
      type: String,
      enum: [
        'ORDER_STATUS',
        'ORDER_CANCEL',
        'PAYMENT_ISSUE',
        'DELIVERY_STATUS',
        'DELIVERY_AVAILABILITY',
        'RETURN_REQUEST',
        'REFUND_STATUS',
        'PRODUCT_INFORMATION',
        'PRODUCT_COMPLAINT',
        'ACCOUNT_ISSUE',
        'GENERAL_QUERY',
        'HUMAN_AGENT_REQUEST',
      ],
      default: null,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },
    toolUsed: {
      type: String,
      default: null,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for efficient conversation history retrieval
ticketMessageSchema.index({ conversationId: 1, createdAt: 1 });
ticketMessageSchema.index({ ticket: 1, createdAt: 1 });

const TicketMessage = mongoose.model('TicketMessage', ticketMessageSchema);
export default TicketMessage;
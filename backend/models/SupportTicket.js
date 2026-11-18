import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      unique: true,
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportCategory',
    },
    subcategory: {
      type: String,
      default: '',
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: [
        'OPEN',
        'ASSIGNED',
        'IN_PROGRESS',
        'WAITING_CUSTOMER',
        'WAITING_INTERNAL',
        'RESOLVED',
        'CLOSED',
        'REOPENED',
      ],
      default: 'OPEN',
    },
    assignedTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportTeam',
    },
    assignedAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    relatedPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    relatedDelivery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryCheckLog',
    },
    relatedReturn: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Return',
    },
    relatedRefund: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Return',
    },

    // AI-Ready fields
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
    aiAgentId: {
      type: String,
      default: null,
    },
    toolUsed: {
      type: String,
      default: null,
    },
    escalated: {
      type: Boolean,
      default: false,
    },
    handoffReason: {
      type: String,
      default: null,
    },
    conversationSummary: {
      type: String,
      default: null,
    },

    // Metadata
    source: {
      type: String,
      enum: ['WEB', 'MOBILE', 'EMAIL', 'CHAT', 'PHONE'],
      default: 'WEB',
    },

    // Tracking fields
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

// Pre-save hook to generate ticketId if not provided
supportTicketSchema.pre('validate', async function (next) {
  if (this.isNew && !this.ticketId) {
    const count = await mongoose.model('SupportTicket').countDocuments();
    this.ticketId = `SUPP${Date.now().toString().slice(-8)}${(count + 1).toString().padStart(6, '0')}`;
  }
  next();
});

// Indexes
supportTicketSchema.index({ customer: 1, status: 1, createdAt: -1 });
supportTicketSchema.index({ category: 1, status: 1 });
supportTicketSchema.index({ assignedAgent: 1, status: 1 });
supportTicketSchema.index({ intent: 1, escalated: 1 });

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
export default SupportTicket;
import mongoose from 'mongoose';

const supportNotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Who triggered the notification
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    actorType: {
      type: String,
      enum: ['CUSTOMER', 'HUMAN_AGENT', 'AI_AGENT', 'SYSTEM'],
    },
    // Notification type
    type: {
      type: String,
      enum: [
        'TICKET_CREATED',
        'AGENT_REPLIED',
        'AI_REPLIED',
        'TICKET_UPDATED',
        'REFUND_UPDATED',
        'RETURN_UPDATED',
        'NEW_TICKET',
        'NEW_CHAT',
        'NEW_CUSTOMER_REPLY',
        'ASSIGNED_TICKET',
        'HIGH_PRIORITY_TICKET',
        'AI_ESCALATION',
      ],
      required: true,
    },
    // Related entities
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportTicket',
    },
    relatedMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TicketMessage',
    },
    // Content preview
    title: {
      type: String,
      trim: true,
    },
    body: {
      type: String,
      trim: true,
    },
    // Delivery status
    channel: {
      type: String,
      enum: ['IN_APP', 'EMAIL', 'SMS', 'PUSH'],
      default: 'IN_APP',
    },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'DELIVERED', 'READ'],
      default: 'PENDING',
    },
    // AI-specific
    aiGenerated: {
      type: Boolean,
      default: false,
    },

    // Timestamps
    createdAt: { type: Date, default: Date.now },
    readAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes
supportNotificationSchema.index({ recipient: 1, status: 1, createdAt: -1 });
supportNotificationSchema.index({ type: 1, status: 1 });
supportNotificationSchema.index({ actorType: 1, createdAt: -1 });

const SupportNotification = mongoose.model('SupportNotification', supportNotificationSchema);
export default SupportNotification;
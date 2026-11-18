import mongoose from 'mongoose';

const supportAuditLogSchema = new mongoose.Schema(
  {
    actorType: {
      type: String,
      enum: ['CUSTOMER', 'HUMAN_AGENT', 'AI_AGENT', 'SYSTEM'],
      required: true,
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    aiAgentId: { type: String, default: null },
    action: {
      type: String,
      enum: [
        'TICKET_CREATED',
        'TICKET_ASSIGNED',
        'TICKET_REASSIGNED',
        'STATUS_CHANGED',
        'PRIORITY_CHANGED',
        'AGENT_REPLY',
        'CUSTOMER_REPLY',
        'AI_REPLY',
        'INTERNAL_NOTE',
        'TICKET_CLOSED',
        'TICKET_REOPENED',
        'REFUND_REQUESTED',
        'REFUND_APPROVED',
        'AI_ESCALATED',
        'AI_TOOL_USED',
        'CHAT_TRANSFERRED',
        'CHAT_CLOSED',
      ],
      required: true,
    },
    module: { type: String, default: 'SUPPORT' },
    referenceId: { type: String, default: null },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket', default: null },
    previousValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    toolUsed: { type: String, default: null },
    intent: { type: String, default: null },
  },
  { timestamps: true }
);

supportAuditLogSchema.index({ ticket: 1, createdAt: -1 });
supportAuditLogSchema.index({ action: 1, createdAt: -1 });
supportAuditLogSchema.index({ actorType: 1, createdAt: -1 });

const SupportAuditLog = mongoose.model('SupportAuditLog', supportAuditLogSchema);
export default SupportAuditLog;

import mongoose from 'mongoose';

// Live-chat room — AI-ready. Same infrastructure will serve HUMAN_AGENT + AI_AGENT.
const conversationSchema = new mongoose.Schema(
  {
    conversationId: { type: String, unique: true, required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTeam', default: null },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket', default: null },
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    status: { type: String, enum: ['ACTIVE', 'WAITING', 'CLOSED'], default: 'ACTIVE' },
    channel: { type: String, enum: ['WEB', 'MOBILE', 'AI_WIDGET'], default: 'WEB' },
    // AI handoff context — populated on escalation so human never re-reads full history
    intent: { type: String, default: null },
    confidence: { type: Number, min: 0, max: 1, default: null },
    escalated: { type: Boolean, default: false },
    handoffReason: { type: String, default: null },
    conversationSummary: { type: String, default: null },
    aiAgentId: { type: String, default: null },
    lastMessageAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

conversationSchema.pre('validate', async function (next) {
  if (this.isNew && !this.conversationId) {
    const count = await mongoose.model('Conversation').countDocuments();
    this.conversationId = `CHAT${Date.now().toString().slice(-8)}${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

conversationSchema.index({ customer: 1, status: 1, lastMessageAt: -1 });
conversationSchema.index({ assignedAgent: 1, status: 1 });
conversationSchema.index({ ticket: 1 });

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;

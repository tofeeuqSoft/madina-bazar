import Conversation from '../../models/Conversation.js';
import ChatMessage from '../../models/ChatMessage.js';
import { logSupportAction } from './auditService.js';
import { searchRegex } from '../../utils/safeRegex.js';

export const listConversations = ({ status, agent, customer, search, page = 1, limit = 20 }) => {
  const q = {};
  if (status) q.status = status;
  if (agent) q.assignedAgent = agent;
  if (customer) q.customer = customer;
  if (search) q.conversationId = searchRegex(search);
  const skip = (Number(page) - 1) * Number(limit);
  return Promise.all([
    Conversation.find(q)
      .populate('customer', 'name email phone')
      .populate('assignedAgent', 'name email role')
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Conversation.countDocuments(q),
  ]);
};

export const getOrCreateConversation = async ({ customerId, orderId = null }) => {
  let convo = await Conversation.findOne({ customer: customerId, status: { $in: ['ACTIVE', 'WAITING'] } }).sort({
    lastMessageAt: -1,
  });
  if (!convo) {
    convo = await Conversation.create({ customer: customerId, relatedOrder: orderId || null });
    await ChatMessage.create({
      conversation: convo._id,
      conversationId: convo.conversationId,
      senderType: 'SYSTEM',
      messageType: 'SYSTEM',
      content: 'Chat started. A support agent will join shortly.',
    });
  }
  return convo;
};

export const postChatMessage = async ({ conversation, senderType, senderId, content, messageType = 'TEXT', mediaUrl = null, ai = {} }) => {
  const msg = await ChatMessage.create({
    conversation: conversation._id,
    conversationId: conversation.conversationId,
    senderType,
    senderId: senderType === 'AI_AGENT' || senderType === 'SYSTEM' ? null : senderId,
    messageType,
    content,
    mediaUrl,
    intent: ai.intent || null,
    confidence: ai.confidence ?? null,
    toolUsed: ai.toolUsed || null,
    escalated: ai.escalated || false,
  });
  conversation.lastMessageAt = new Date();
  if (ai.escalated) {
    conversation.escalated = true;
    conversation.handoffReason = ai.handoffReason || conversation.handoffReason;
    conversation.conversationSummary = ai.conversationSummary || conversation.conversationSummary;
    conversation.intent = ai.intent || conversation.intent;
  }
  await conversation.save();
  return msg;
};

export const chatHistory = ({ conversationId, page = 1, limit = 50 }) => {
  const skip = (Number(page) - 1) * Number(limit);
  return Promise.all([
    ChatMessage.find({ conversation: conversationId }).sort({ createdAt: 1 }).skip(skip).limit(Number(limit)),
    ChatMessage.countDocuments({ conversation: conversationId }),
  ]);
};

export const closeConversation = async ({ conversation, actor }) => {
  conversation.status = 'CLOSED';
  conversation.closedAt = new Date();
  await conversation.save();
  await logSupportAction({
    actorType: actor?.role === 'CUSTOMER' ? 'CUSTOMER' : 'HUMAN_AGENT',
    actor: actor?._id || null,
    action: 'CHAT_CLOSED',
    referenceId: conversation.conversationId,
  });
  return conversation;
};

import SupportTicket from '../../models/SupportTicket.js';
import TicketMessage from '../../models/TicketMessage.js';
import SupportCategory from '../../models/SupportCategory.js';
import SupportNotification from '../../models/SupportNotification.js';
import { logSupportAction, actorTypeOf } from './auditService.js';
import { autoAssignTicket } from './assignmentService.js';
import { searchRegex } from '../../utils/safeRegex.js';

const VALID_TRANSITIONS = {
  OPEN: ['ASSIGNED', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_INTERNAL', 'RESOLVED', 'OPEN'],
  IN_PROGRESS: ['WAITING_CUSTOMER', 'WAITING_INTERNAL', 'RESOLVED', 'OPEN'],
  WAITING_CUSTOMER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'],
  WAITING_INTERNAL: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED'],
};

export const listTickets = ({ status, priority, category, agent, search, page = 1, limit = 20, extra = {} }) => {
  const q = { ...extra };
  if (status) q.status = status;
  if (priority) q.priority = priority;
  if (category) q.category = category;
  if (agent) q.assignedAgent = agent;
  if (search) {
    q.$or = [{ ticketId: searchRegex(search) }, { subject: searchRegex(search) }];
  }
  const skip = (Number(page) - 1) * Number(limit);
  return Promise.all([
    SupportTicket.find(q)
      .populate('customer', 'name email phone')
      .populate('category', 'name slug')
      .populate('assignedAgent', 'name email role')
      .populate('assignedTeam', 'name teamType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    SupportTicket.countDocuments(q),
  ]);
};

export const createTicket = async ({ data, actor = null }) => {
  const categoryDoc = data.category ? await SupportCategory.findById(data.category) : null;
  const ticket = await SupportTicket.create({
    customer: data.customer,
    category: data.category || null,
    subcategory: data.subcategory || '',
    subject: data.subject,
    description: data.description || '',
    priority: data.priority || 'MEDIUM',
    intent: data.intent || null,
    relatedOrder: data.relatedOrder || null,
    relatedPayment: data.relatedPayment || null,
    relatedReturn: data.relatedReturn || null,
    source: data.source || 'WEB',
  });

  // First customer message in thread
  if (data.description) {
    await TicketMessage.create({
      conversationId: ticket.ticketId,
      ticket: ticket._id,
      senderType: actor?.role === 'CUSTOMER' ? 'CUSTOMER' : 'HUMAN_AGENT',
      senderId: actor?._id || data.customer,
      messageType: 'TEXT',
      content: data.description,
      intent: data.intent || null,
    });
  }

  // Auto-route to team/agent
  try {
    await autoAssignTicket(ticket, categoryDoc);
  } catch (e) {
    console.error('auto-assign failed:', e.message);
  }

  await logSupportAction({
    actorType: actorTypeOf(actor, actor?.role === 'CUSTOMER' ? 'CUSTOMER' : 'HUMAN_AGENT'),
    actor: actor?._id || null,
    action: 'TICKET_CREATED',
    referenceId: ticket.ticketId,
    ticket: ticket._id,
    newValue: { status: ticket.status, priority: ticket.priority },
    intent: ticket.intent,
  });

  // Notify agents (in-app)
  try {
    await SupportNotification.create({
      recipient: data.customer,
      actor: actor?._id || null,
      actorType: 'SYSTEM',
      type: 'TICKET_CREATED',
      ticket: ticket._id,
      title: `Ticket ${ticket.ticketId} created`,
      body: data.subject,
    });
  } catch (e) {
    console.error('ticket notification failed:', e.message);
  }

  return ticket;
};

export const changeStatus = async ({ ticket, status, actor }) => {
  const allowed = VALID_TRANSITIONS[ticket.status] || [];
  if (!allowed.includes(status)) {
    const err = new Error(`Invalid transition ${ticket.status} -> ${status}`);
    err.statusCode = 400;
    throw err;
  }
  const prev = ticket.status;
  ticket.status = status;
  if (status === 'RESOLVED') ticket.resolvedAt = new Date();
  if (status === 'CLOSED') ticket.closedAt = new Date();
  await ticket.save();

  await logSupportAction({
    actorType: actorTypeOf(actor),
    actor: actor?._id || null,
    action: status === 'CLOSED' ? 'TICKET_CLOSED' : status === 'REOPENED' ? 'TICKET_REOPENED' : 'STATUS_CHANGED',
    referenceId: ticket.ticketId,
    ticket: ticket._id,
    previousValue: { status: prev },
    newValue: { status },
  });
  return ticket;
};

export const addMessage = async ({ ticket, senderType, senderId, content, messageType = 'TEXT', mediaUrl = null, ai = {} }) => {
  const msg = await TicketMessage.create({
    conversationId: ticket.ticketId,
    ticket: ticket._id,
    senderType,
    senderId: senderType === 'AI_AGENT' || senderType === 'SYSTEM' ? null : senderId,
    messageType,
    content,
    mediaUrl,
    intent: ai.intent || null,
    confidence: ai.confidence ?? null,
    toolUsed: ai.toolUsed || null,
  });

  ticket.updatedAt = new Date();
  // Reopen resolved tickets on new customer reply
  if (senderType === 'CUSTOMER' && ['RESOLVED', 'CLOSED'].includes(ticket.status)) {
    ticket.status = 'REOPENED';
  }
  await ticket.save();

  await logSupportAction({
    actorType: senderType,
    actor: senderId || null,
    aiAgentId: senderType === 'AI_AGENT' ? ai.aiAgentId || 'ai-assistant' : null,
    action: senderType === 'AI_AGENT' ? 'AI_REPLY' : senderType === 'CUSTOMER' ? 'CUSTOMER_REPLY' : 'AGENT_REPLY',
    referenceId: ticket.ticketId,
    ticket: ticket._id,
    intent: ai.intent || null,
    toolUsed: ai.toolUsed || null,
  });

  return msg;
};

export const ticketMessages = ({ ticketId, page = 1, limit = 50 }) => {
  const skip = (Number(page) - 1) * Number(limit);
  return Promise.all([
    TicketMessage.find({ ticket: ticketId }).sort({ createdAt: 1 }).skip(skip).limit(Number(limit)),
    TicketMessage.countDocuments({ ticket: ticketId }),
  ]);
};

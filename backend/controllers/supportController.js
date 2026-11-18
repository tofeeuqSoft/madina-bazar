import SupportTicket from '../models/SupportTicket.js';
import TicketMessage from '../models/TicketMessage.js';
import SupportCategory from '../models/SupportCategory.js';
import SupportTeam from '../models/SupportTeam.js';
import Conversation from '../models/Conversation.js';
import ChatMessage from '../models/ChatMessage.js';
import FAQArticle from '../models/FAQArticle.js';
import CannedResponse from '../models/CannedResponse.js';
import CustomerFeedback from '../models/CustomerFeedback.js';
import SupportNotification from '../models/SupportNotification.js';
import SupportAuditLog from '../models/SupportAuditLog.js';
import CustomerNote from '../models/CustomerNote.js';
import User from '../models/User.js';
import { hasPermission } from '../utils/permissions.js';
import { listTickets, createTicket, changeStatus, addMessage, ticketMessages } from '../services/support/ticketService.js';
import { listConversations, getOrCreateConversation, postChatMessage as postChatMessageSvcFn, chatHistory, closeConversation } from '../services/support/chatService.js';
import { autoAssignTicket, supportAgents } from '../services/support/assignmentService.js';
import { supportDashboard, supportReports } from '../services/support/dashboardService.js';
import { customer360 } from '../services/support/customer360Service.js';
import { logSupportAction, actorTypeOf } from '../services/support/auditService.js';
import { searchRegex, escapeRegExp } from '../utils/safeRegex.js';
import * as aiTools from '../services/support/aiToolService.js';

const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const isStaff = (user) => user && user.role !== 'CUSTOMER';

// Staff see everything; customers only their own tickets/conversations
const ticketScope = (req, q = {}) => {
  if (isStaff(req.user)) return q;
  return { ...q, customer: req.user._id };
};

const assertTicketAccess = async (req, ticketId) => {
  const t = await SupportTicket.findById(ticketId);
  if (!t) {
    const e = new Error('Ticket not found');
    e.statusCode = 404;
    return { error: e };
  }
  if (!isStaff(req.user) && String(t.customer) !== String(req.user._id)) {
    const e = new Error('Not authorized to access this ticket');
    e.statusCode = 403;
    e.code = 'SUPPORT_PERMISSION_DENIED';
    return { error: e };
  }
  return { ticket: t };
};

const assertConvoAccess = async (req, convoId) => {
  const c = await Conversation.findById(convoId);
  if (!c) {
    const e = new Error('Conversation not found');
    e.statusCode = 404;
    return { error: e };
  }
  if (!isStaff(req.user) && String(c.customer) !== String(req.user._id)) {
    const e = new Error('Not authorized to access this conversation');
    e.statusCode = 403;
    e.code = 'SUPPORT_PERMISSION_DENIED';
    return { error: e };
  }
  return { convo: c };
};

// ---------- Dashboard / Reports ----------
export const getDashboard = asyncH(async (req, res) => {
  res.json({ success: true, data: await supportDashboard() });
});
export const getReports = asyncH(async (req, res) => {
  res.json({ success: true, data: await supportReports() });
});

// ---------- Tickets ----------
export const getTickets = asyncH(async (req, res) => {
  const { status, priority, category, agent, search, page, limit } = req.query;
  const scope = ticketScope(req);
  // Customers cannot filter by other agents
  const [data, total] = await listTickets({ status, priority, category, agent: isStaff(req.user) ? agent : undefined, search, page, limit, extra: scope });
  res.json({ success: true, total, data });
});
export const getTicket = asyncH(async (req, res) => {
  const { error } = await assertTicketAccess(req, req.params.id);
  if (error) throw error;
  const t = await SupportTicket.findById(req.params.id)
    .populate('customer', 'name email phone')
    .populate('category', 'name slug')
    .populate('assignedAgent', 'name email role')
    .populate('assignedTeam', 'name teamType')
    .populate('relatedOrder', 'orderNumber orderStatus paymentStatus totalAmount');
  if (!t) return res.status(404).json({ success: false, message: 'Ticket not found' });
  res.json({ success: true, data: t });
});
export const postTicket = asyncH(async (req, res) => {
  // Customers always file as themselves; staff may file on behalf of a customer
  const customerId = req.user.role === 'CUSTOMER' ? req.user._id : req.body.customer || req.user._id;
  if (!req.body.subject) return res.status(400).json({ success: false, message: 'subject is required', code: 'SUPPORT_VALIDATION' });
  const ticket = await createTicket({ data: { ...req.body, customer: customerId }, actor: req.user });
  res.status(201).json({ success: true, data: ticket });
});
export const patchTicketStatus = asyncH(async (req, res) => {
  const t = await SupportTicket.findById(req.params.id);
  if (!t) return res.status(404).json({ success: false, message: 'Ticket not found' });
  await changeStatus({ ticket: t, status: req.body.status, actor: req.user });
  res.json({ success: true, data: t });
});
export const patchTicketAssign = asyncH(async (req, res) => {
  const t = await SupportTicket.findById(req.params.id);
  if (!t) return res.status(404).json({ success: false, message: 'Ticket not found' });
  const prev = { agent: t.assignedAgent, team: t.assignedTeam };
  if (req.body.agent) t.assignedAgent = req.body.agent;
  if (req.body.team) t.assignedTeam = req.body.team;
  if (req.body.priority) t.priority = req.body.priority;
  if (['OPEN', 'REOPENED'].includes(t.status) && t.assignedAgent) t.status = 'ASSIGNED';
  await t.save();
  await logSupportAction({
    actorType: actorTypeOf(req.user), actor: req.user._id,
    action: 'TICKET_ASSIGNED', referenceId: t.ticketId, ticket: t._id,
    previousValue: prev, newValue: { agent: t.assignedAgent, team: t.assignedTeam },
  });
  res.json({ success: true, data: t });
});
export const autoAssign = asyncH(async (req, res) => {
  const t = await SupportTicket.findById(req.params.id).populate('category');
  if (!t) return res.status(404).json({ success: false, message: 'Ticket not found' });
  await autoAssignTicket(t, t.category);
  await logSupportAction({
    actorType: actorTypeOf(req.user), actor: req.user._id,
    action: 'TICKET_ASSIGNED', referenceId: t.ticketId, ticket: t._id,
    newValue: { agent: t.assignedAgent, team: t.assignedTeam, auto: true },
  });
  res.json({ success: true, data: t });
});
export const getTicketMessages = asyncH(async (req, res) => {
  const { error } = await assertTicketAccess(req, req.params.id);
  if (error) throw error;
  const [data, total] = await ticketMessages({ ticketId: req.params.id, page: req.query.page, limit: req.query.limit });
  res.json({ success: true, total, data });
});
export const postTicketMessage = asyncH(async (req, res) => {
  const { ticket: t, error } = await assertTicketAccess(req, req.params.id);
  if (error) throw error;
  const senderType = req.user.role === 'CUSTOMER' ? 'CUSTOMER' : 'HUMAN_AGENT';
  const msg = await addMessage({
    ticket: t, senderType, senderId: req.user._id,
    content: req.body.content, messageType: req.body.messageType || 'TEXT', mediaUrl: req.body.mediaUrl || null,
  });
  // Customer-visible notification for agent replies
  if (senderType === 'HUMAN_AGENT') {
    await SupportNotification.create({
      recipient: t.customer, actor: req.user._id, actorType: 'HUMAN_AGENT',
      type: 'AGENT_REPLIED', ticket: t._id, relatedMessage: msg._id,
      title: `Reply on ${t.ticketId}`, body: String(req.body.content).slice(0, 160),
    });
  }
  if (global.supportIO) global.supportIO.to(`ticket:${t.ticketId}`).emit('ticket:message', msg);
  res.status(201).json({ success: true, data: msg });
});

// ---------- Conversations / Live chat ----------
export const getConversations = asyncH(async (req, res) => {
  const q = { ...req.query };
  if (!isStaff(req.user)) {
    q.customer = req.user._id;
    delete q.agent;
  }
  const [data, total] = await listConversations(q);
  res.json({ success: true, total, data });
});
export const postConversation = asyncH(async (req, res) => {
  const customerId = req.user.role === 'CUSTOMER' ? req.user._id : req.body.customer || req.user._id;
  const convo = await getOrCreateConversation({ customerId, orderId: req.body.orderId || null });
  res.status(201).json({ success: true, data: convo });
});
export const getConversation = asyncH(async (req, res) => {
  const { error } = await assertConvoAccess(req, req.params.id);
  if (error) throw error;
  const c = await Conversation.findById(req.params.id).populate('customer', 'name email phone').populate('assignedAgent', 'name email role');
  if (!c) return res.status(404).json({ success: false, message: 'Conversation not found' });
  res.json({ success: true, data: c });
});
export const getChatMessages = asyncH(async (req, res) => {
  const { error } = await assertConvoAccess(req, req.params.id);
  if (error) throw error;
  const [data, total] = await chatHistory({ conversationId: req.params.id, page: req.query.page, limit: req.query.limit });
  res.json({ success: true, total, data });
});
export const postChatMessage = asyncH(async (req, res) => {
  const { convo: c, error } = await assertConvoAccess(req, req.params.id);
  if (error) throw error;
  const senderType = req.user.role === 'CUSTOMER' ? 'CUSTOMER' : 'HUMAN_AGENT';
  const msg = await postChatMessageSvc(c, senderType, req);
  if (global.supportIO) {
    global.supportIO.to(`chat:${c.conversationId}`).emit('chat:message', msg);
    global.supportIO.to(`ticket:${c.ticket?.toString() || ''}`).emit('chat:message', msg);
  }
  res.status(201).json({ success: true, data: msg });
});
const postChatMessageSvc = async (c, senderType, req) =>
  postChatMessageSvcFn({
    conversation: c, senderType, senderId: req.user._id,
    content: req.body.content, messageType: req.body.messageType || 'TEXT', mediaUrl: req.body.mediaUrl || null,
  });
export const patchConversation = asyncH(async (req, res) => {
  const c = await Conversation.findById(req.params.id);
  if (!c) return res.status(404).json({ success: false, message: 'Conversation not found' });
  if (req.body.assignedAgent) c.assignedAgent = req.body.assignedAgent;
  if (req.body.status === 'CLOSED') return res.json({ success: true, data: await closeConversation({ conversation: c, actor: req.user }) });
  if (req.body.status) c.status = req.body.status;
  await c.save();
  res.json({ success: true, data: c });
});

// ---------- Customer 360 ----------
export const getCustomer360 = asyncH(async (req, res) => {
  const data = await customer360(req.params.id);
  // Internal notes visible only to privileged support staff
  if (!hasPermission(req.user, 'SUPPORT_VIEW')) delete data.internalNotes;
  res.json({ success: true, data });
});
export const searchSupport = asyncH(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ success: true, data: { customers: [], tickets: [], orders: [] } });
  const rx = searchRegex(q);
  const [customers, tickets] = await Promise.all([
    User.find({ $or: [{ name: rx }, { email: rx }, { phone: rx }] }).limit(10).select('name email phone role'),
    SupportTicket.find({ $or: [{ ticketId: rx }, { subject: rx }] }).limit(10).select('ticketId subject status priority'),
  ]);
  res.json({ success: true, data: { customers, tickets, orders: [] } });
});

// ---------- Internal notes (never customer-visible) ----------
export const getNotes = asyncH(async (req, res) => {
  const q = {};
  if (req.query.customer) q.customer = req.query.customer;
  if (req.query.ticket) q.ticket = req.query.ticket;
  const data = await CustomerNote.find(q).populate('createdBy', 'name role').sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, data });
});
export const postNote = asyncH(async (req, res) => {
  const note = await CustomerNote.create({ ...req.body, createdBy: req.user._id });
  await logSupportAction({
    actorType: actorTypeOf(req.user), actor: req.user._id, action: 'INTERNAL_NOTE',
    referenceId: req.body.ticket || req.body.customer, ticket: req.body.ticket || null,
  });
  res.status(201).json({ success: true, data: note });
});

// ---------- Categories / Teams / Agents ----------
export const getCategories = asyncH(async (req, res) => {
  res.json({ success: true, data: await SupportCategory.find({}).sort({ sortOrder: 1 }) });
});
export const postCategory = asyncH(async (req, res) => {
  const slug = req.body.slug || String(req.body.name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  res.status(201).json({ success: true, data: await SupportCategory.create({ ...req.body, slug }) });
});
export const getTeams = asyncH(async (req, res) => {
  res.json({ success: true, data: await SupportTeam.find({}).populate('members', 'name email role').sort({ sortOrder: 1 }) });
});
export const postTeam = asyncH(async (req, res) => {
  const slug = req.body.slug || String(req.body.name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  res.status(201).json({ success: true, data: await SupportTeam.create({ ...req.body, slug }) });
});
export const patchTeam = asyncH(async (req, res) => {
  const t = await SupportTeam.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data: t });
});
export const getAgents = asyncH(async (req, res) => {
  res.json({ success: true, data: await supportAgents() });
});

// ---------- FAQ / Canned ----------
export const getFaq = asyncH(async (req, res) => {
  const q = {};
  if (req.query.category) q.category = req.query.category;
  if (req.query.search) q.$text = { $search: req.query.search };
  if (req.query.active !== 'all') q.isActive = true;
  res.json({ success: true, data: await FAQArticle.find(q).sort({ updatedAt: -1 }).limit(100) });
});
export const postFaq = asyncH(async (req, res) => {
  const slug = req.body.slug || `${String(req.body.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}-${Date.now().toString(36)}`;
  const doc = await FAQArticle.create({ ...req.body, slug, createdBy: req.user._id, version: 1 });
  res.status(201).json({ success: true, data: doc });
});
export const patchFaq = asyncH(async (req, res) => {
  const doc = await SupportPatch(FAQArticle, req.params.id, { ...req.body, updatedBy: req.user._id, $inc: { version: 1 } });
  res.json({ success: true, data: doc });
});
const SupportPatch = async (Model, id, body) => {
  const { $inc, ...rest } = body;
  const doc = await Model.findById(id);
  Object.assign(doc, rest);
  if ($inc?.version) doc.version += 1;
  await doc.save();
  return doc;
};
export const getCanned = asyncH(async (req, res) => {
  const q = {};
  if (req.query.category) q.category = req.query.category;
  res.json({ success: true, data: await CannedResponse.find(q).sort({ usageCount: -1 }).limit(100) });
});
export const postCanned = asyncH(async (req, res) => {
  const slug = req.body.slug || String(req.body.name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  res.status(201).json({ success: true, data: await CannedResponse.create({ ...req.body, slug, createdBy: req.user._id }) });
});
export const patchCanned = asyncH(async (req, res) => {
  res.json({ success: true, data: await CannedResponse.findByIdAndUpdate(req.params.id, { ...req.body, updatedBy: req.user._id }, { new: true }) });
});
export const useCanned = asyncH(async (req, res) => {
  const c = await CannedResponse.findById(req.params.id);
  if (c) {
    c.usageCount += 1;
    await c.save();
  }
  // Variable interpolation: {customer_name} {order_id} {ticket_id}
  let text = c?.template || '';
  const vars = req.body.variables || {};
  Object.entries(vars).forEach(([k, v]) => {
    text = text.replace(new RegExp(`\\{${escapeRegExp(k)}\\}`, 'g'), v);
  });
  res.json({ success: true, data: { template: c, rendered: text } });
});

// ---------- Feedback / Notifications / Audit ----------
export const getFeedback = asyncH(async (req, res) => {
  res.json({ success: true, data: await CustomerFeedback.find({}).populate('customer', 'name').sort({ createdAt: -1 }).limit(100) });
});
export const postFeedback = asyncH(async (req, res) => {
  const fb = await CustomerFeedback.create({
    ticket: req.body.ticket || null,
    conversation: req.body.conversation || null,
    customer: req.user.role === 'CUSTOMER' ? req.user._id : req.body.customer,
    rating: req.body.rating,
    comment: req.body.comment || '',
    ratedAspect: req.body.ratedAspect || 'OVERALL',
  });
  res.status(201).json({ success: true, data: fb });
});
export const getNotifications = asyncH(async (req, res) => {
  const data = await SupportNotification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, data });
});
export const readNotification = asyncH(async (req, res) => {
  const n = await SupportNotification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { status: 'READ', readAt: new Date() },
    { new: true }
  );
  res.json({ success: true, data: n });
});
export const getAuditLogs = asyncH(async (req, res) => {
  const q = {};
  if (req.query.ticket) q.ticket = req.query.ticket;
  if (req.query.action) q.action = req.query.action;
  if (req.query.actorType) q.actorType = req.query.actorType;
  const data = await SupportAuditLog.find(q).sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, data });
});

// ---------- AI tool layer (strict auth + audited, read-only default) ----------
export const aiContext = asyncH(async (req, res) => {
  // Returns conversation + customer + order context for handoff — never raw DB handles
  const ticket = req.query.ticket ? await SupportTicket.findById(req.query.ticket).populate('customer', 'name email phone').populate('relatedOrder') : null;
  const messages = ticket ? await TicketMessage.find({ ticket: ticket._id }).sort({ createdAt: 1 }).limit(50) : [];
  res.json({
    success: true,
    data: {
      ticket,
      messages: messages.map((m) => ({ senderType: m.senderType, content: m.content, intent: m.intent, createdAt: m.createdAt })),
      tools: aiTools.AI_TOOLS,
      confidenceThreshold: Number(process.env.AI_CONFIDENCE_THRESHOLD || 0.75),
    },
  });
});
export const aiTool = asyncH(async (req, res) => {
  const { tool, args } = req.body;
  if (!aiTools.AI_TOOLS.includes(tool)) return res.status(400).json({ success: false, message: 'Unknown tool' });
  if (['requestReturn', 'createSupportTicket'].includes(tool) && !hasPermission(req.user, 'SUPPORT_REFUND_REQUEST') && req.user.role !== 'CUSTOMER') {
    return res.status(403).json({ success: false, message: 'Tool requires explicit permission' });
  }
  const fn = aiTools[tool];
  if (typeof fn !== 'function') return res.status(400).json({ success: false, message: 'Tool not executable' });
  const result = await fn(args, req.user);
  res.json({ success: true, data: result });
});
export const aiHandoff = asyncH(async (req, res) => {
  const { conversationId, ticketId, reason, summary, intent, actionsTaken, pendingAction } = req.body;
  let convo = conversationId ? await Conversation.findOne({ conversationId }) : null;
  const ticket = ticketId ? await SupportTicket.findById(ticketId) : null;
  if (convo) {
    convo.escalated = true;
    convo.handoffReason = reason || 'AI low confidence';
    convo.conversationSummary = summary || convo.conversationSummary;
    convo.intent = intent || convo.intent;
    convo.status = 'WAITING';
    await convo.save();
  }
  if (ticket) {
    ticket.escalated = true;
    ticket.handoffReason = reason || 'AI handoff';
    ticket.conversationSummary = summary || ticket.conversationSummary;
    ticket.intent = intent || ticket.intent;
    await ticket.save();
  }
  await logSupportAction({
    actorType: 'AI_AGENT', aiAgentId: 'ai-assistant', action: 'AI_ESCALATED',
    referenceId: conversationId || ticket?.ticketId, ticket: ticket?._id || null,
    newValue: { reason, summary, intent, actionsTaken, pendingAction },
    intent: intent || null,
  });
  res.json({ success: true, data: { conversation: convo, ticket } });
});

import express from 'express';
import { protect, checkPermission } from '../middleware/authMiddleware.js';
import * as c from '../controllers/supportController.js';

const router = express.Router();
router.use(protect);

// Dashboard / reports
router.get('/dashboard', checkPermission('SUPPORT_VIEW', 'SUPPORT_REPORT_VIEW'), c.getDashboard);
router.get('/reports', checkPermission('SUPPORT_REPORT_VIEW', 'SUPPORT_VIEW'), c.getReports);

// Tickets — customers access ONLY their own (ownership enforced in controller)
router.get('/tickets', c.getTickets);
router.post('/tickets', c.postTicket);
router.get('/tickets/:id', c.getTicket);
router.patch('/tickets/:id/status', checkPermission('SUPPORT_REPLY'), c.patchTicketStatus);
router.patch('/tickets/:id/assign', checkPermission('SUPPORT_ASSIGN'), c.patchTicketAssign);
router.post('/tickets/:id/auto-assign', checkPermission('SUPPORT_ASSIGN'), c.autoAssign);
router.get('/tickets/:id/messages', c.getTicketMessages);
router.post('/tickets/:id/messages', c.postTicketMessage);

// Conversations / live chat — same ownership rule (staff-only ops stay guarded)
router.get('/conversations', c.getConversations);
router.post('/conversations', c.postConversation);
router.get('/conversations/:id', c.getConversation);
router.patch('/conversations/:id', checkPermission('SUPPORT_REPLY'), c.patchConversation);
router.get('/conversations/:id/messages', c.getChatMessages);
router.post('/conversations/:id/messages', c.postChatMessage);
router.get('/chat', checkPermission('SUPPORT_VIEW'), c.getConversations);

// Customer 360 + global search
router.get('/customers/:id', checkPermission('SUPPORT_CUSTOMER_VIEW', 'SUPPORT_VIEW'), c.getCustomer360);
router.get('/search', checkPermission('SUPPORT_VIEW'), c.searchSupport);

// Internal notes
router.get('/notes', checkPermission('SUPPORT_VIEW'), c.getNotes);
router.post('/notes', checkPermission('SUPPORT_REPLY'), c.postNote);

// Categories / teams / agents
router.get('/categories', checkPermission('SUPPORT_VIEW'), c.getCategories);
router.post('/categories', checkPermission('SUPPORT_FAQ_MANAGE', 'SUPPORT_ASSIGN'), c.postCategory);
router.get('/teams', checkPermission('SUPPORT_VIEW'), c.getTeams);
router.post('/teams', checkPermission('SUPPORT_ASSIGN'), c.postTeam);
router.patch('/teams/:id', checkPermission('SUPPORT_ASSIGN'), c.patchTeam);
router.get('/agents', checkPermission('SUPPORT_VIEW'), c.getAgents);

// FAQ / canned
router.get('/faq', c.getFaq);
router.post('/faq', checkPermission('SUPPORT_FAQ_MANAGE'), c.postFaq);
router.patch('/faq/:id', checkPermission('SUPPORT_FAQ_MANAGE'), c.patchFaq);
router.get('/canned-responses', checkPermission('SUPPORT_VIEW'), c.getCanned);
router.post('/canned-responses', checkPermission('SUPPORT_CANNED_MANAGE'), c.postCanned);
router.patch('/canned-responses/:id', checkPermission('SUPPORT_CANNED_MANAGE'), c.patchCanned);
router.post('/canned-responses/:id/use', checkPermission('SUPPORT_REPLY'), c.useCanned);

// Feedback / notifications / audit
router.get('/feedback', checkPermission('SUPPORT_REPORT_VIEW', 'SUPPORT_VIEW'), c.getFeedback);
router.post('/feedback', c.postFeedback);
router.get('/notifications', c.getNotifications);
router.patch('/notifications/:id/read', c.readNotification);
router.get('/audit-logs', checkPermission('SUPPORT_REPORT_VIEW', 'SUPPORT_VIEW'), c.getAuditLogs);

// AI layer — strict: AI_MANAGER or SUPPORT_* with explicit tool permission
router.get('/ai/context', checkPermission('SUPPORT_AI_MANAGE', 'SUPPORT_VIEW'), c.aiContext);
router.post('/ai/tools', checkPermission('SUPPORT_AI_MANAGE', 'SUPPORT_VIEW'), c.aiTool);
router.post('/ai/handoff', checkPermission('SUPPORT_AI_MANAGE', 'SUPPORT_REPLY'), c.aiHandoff);
router.get('/ai/conversations', checkPermission('SUPPORT_AI_MANAGE', 'SUPPORT_VIEW'), c.getConversations);

export default router;

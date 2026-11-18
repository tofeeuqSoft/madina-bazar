import SupportTicket from '../../models/SupportTicket.js';
import Conversation from '../../models/Conversation.js';
import CustomerFeedback from '../../models/CustomerFeedback.js';
import Return from '../../models/Return.js';

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const supportDashboard = async () => {
  const today = startOfDay();
  const [
    newTickets,
    openTickets,
    pendingTickets,
    highPriority,
    urgentTickets,
    unassigned,
    activeChats,
    resolvedToday,
    todaysConversations,
    todaysComplaints,
    returnRequests,
    refundRequests,
    feedbackAgg,
    byDay,
    byCategory,
    byStatus,
    byPriority,
  ] = await Promise.all([
    SupportTicket.countDocuments({ createdAt: { $gte: today } }),
    SupportTicket.countDocuments({ status: { $in: ['OPEN', 'ASSIGNED', 'REOPENED'] } }),
    SupportTicket.countDocuments({ status: { $in: ['IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_INTERNAL'] } }),
    SupportTicket.countDocuments({ priority: 'HIGH', status: { $nin: ['RESOLVED', 'CLOSED'] } }),
    SupportTicket.countDocuments({ priority: 'URGENT', status: { $nin: ['RESOLVED', 'CLOSED'] } }),
    SupportTicket.countDocuments({ assignedAgent: null, status: { $nin: ['RESOLVED', 'CLOSED'] } }),
    Conversation.countDocuments({ status: 'ACTIVE' }),
    SupportTicket.countDocuments({ resolvedAt: { $gte: today } }),
    Conversation.countDocuments({ createdAt: { $gte: today } }),
    SupportTicket.countDocuments({ createdAt: { $gte: today }, priority: { $in: ['HIGH', 'URGENT'] } }),
    Return.countDocuments({ createdAt: { $gte: today } }),
    Return.countDocuments({ createdAt: { $gte: today } }),
    CustomerFeedback.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
    SupportTicket.aggregate([
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 14 },
    ]),
    SupportTicket.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    SupportTicket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    SupportTicket.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
  ]);

  const satisfaction = feedbackAgg[0]?.avg ? Number(feedbackAgg[0].avg.toFixed(2)) : 0;

  return {
    cards: {
      newTickets,
      openTickets,
      pendingTickets,
      highPriority,
      urgentTickets,
      unassignedTickets: unassigned,
      activeChats,
      resolvedToday,
      avgResponseTime: null, // computed in reports when message timestamps exist
      avgResolutionTime: null,
      customerSatisfaction: satisfaction,
    },
    metrics: {
      todaysConversations,
      todaysComplaints,
      returnRequests,
      refundRequests,
      deliveryComplaints: 0,
      paymentIssues: 0,
    },
    charts: { byDay: byDay.reverse(), byCategory, byStatus, byPriority },
  };
};

export const supportReports = async () => {
  const [total, open, resolved, closed, agentPerf, satisfaction] = await Promise.all([
    SupportTicket.countDocuments(),
    SupportTicket.countDocuments({ status: { $in: ['OPEN', 'ASSIGNED', 'REOPENED'] } }),
    SupportTicket.countDocuments({ status: 'RESOLVED' }),
    SupportTicket.countDocuments({ status: 'CLOSED' }),
    SupportTicket.aggregate([
      { $match: { assignedAgent: { $ne: null } } },
      { $group: { _id: '$assignedAgent', assigned: { $sum: 1 } } },
      { $limit: 20 },
    ]),
    CustomerFeedback.aggregate([
      { $group: { _id: '$ratedAspect', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
  ]);
  return {
    totals: { total, open, resolved, closed },
    agentPerformance: agentPerf,
    satisfaction,
    ai: { conversations: 0, resolutionRate: 0, escalationRate: 0, handoffRate: 0 },
  };
};

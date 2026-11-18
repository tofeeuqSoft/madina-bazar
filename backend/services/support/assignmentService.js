import User from '../../models/User.js';
import SupportTicket from '../../models/SupportTicket.js';
import SupportTeam from '../../models/SupportTeam.js';

// Category slug -> teamType mapping (configurable via SupportTeam docs)
const CATEGORY_TEAM_MAP = {
  'payment-issue': 'PAYMENT_SUPPORT',
  'delivery-issue': 'DELIVERY_SUPPORT',
  'grocery-delivery': 'DELIVERY_SUPPORT',
  'nationwide-delivery': 'DELIVERY_SUPPORT',
  'return-request': 'RETURN_TEAM',
  'refund-request': 'REFUND_TEAM',
  cancellation: 'GENERAL_SUPPORT',
  'product-issue': 'PRODUCT_SUPPORT',
  'wrong-product': 'PRODUCT_SUPPORT',
  'damaged-product': 'PRODUCT_SUPPORT',
  'missing-product': 'PRODUCT_SUPPORT',
  'account-issue': 'GENERAL_SUPPORT',
  'technical-problem': 'TECHNICAL_TEAM',
  'coupon-issue': 'GENERAL_SUPPORT',
};

export const resolveTeamForCategory = async (categoryDoc) => {
  if (!categoryDoc) return null;
  const teamType = CATEGORY_TEAM_MAP[categoryDoc.slug] || 'GENERAL_SUPPORT';
  return SupportTeam.findOne({ teamType, isActive: true });
};

// Automatic assignment: ROUND_ROBIN / LEAST_BUSY / CATEGORY_BASED
export const autoAssignTicket = async (ticket, categoryDoc = null) => {
  const team = ticket.assignedTeam
    ? await SupportTeam.findById(ticket.assignedTeam)
    : await resolveTeamForCategory(categoryDoc);

  let agentId = null;

  if (team?.members?.length) {
    if (team.assignmentRule === 'LEAST_BUSY') {
      // Agent in this team with fewest open tickets
      const counts = await SupportTicket.aggregate([
        {
          $match: {
            assignedAgent: { $in: team.members },
            status: { $in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_INTERNAL', 'REOPENED'] },
          },
        },
        { $group: { _id: '$assignedAgent', count: { $sum: 1 } } },
      ]);
      const map = new Map(counts.map((c) => [String(c._id), c.count]));
      agentId = [...team.members].sort(
        (a, b) => (map.get(String(a)) || 0) - (map.get(String(b)) || 0)
      )[0];
    } else {
      // ROUND_ROBIN (default): rotate by total ticket count
      const total = await SupportTicket.countDocuments();
      agentId = team.members[total % team.members.length];
    }

    // Ensure agent still active
    const agent = agentId ? await User.findOne({ _id: agentId, isActive: true }) : null;
    if (agent) {
      ticket.assignedAgent = agent._id;
      if (['OPEN', 'REOPENED'].includes(ticket.status)) ticket.status = 'ASSIGNED';
    }
  }

  if (team) ticket.assignedTeam = team._id;
  await ticket.save();
  return ticket;
};

export const supportAgents = (filter = {}) =>
  User.find({
    role: { $in: ['SUPPORT_AGENT', 'SUPPORT_MANAGER', 'DELIVERY_SUPPORT', 'PAYMENT_SUPPORT', 'REFUND_MANAGER'] },
    ...filter,
  })
    .select('name email phone role isActive avatar')
    .sort({ name: 1 });

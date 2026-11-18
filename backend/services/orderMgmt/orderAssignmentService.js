import User from '../../models/User.js';
import Order from '../../models/Order.js';

const AGENT_ROLES = ['ORDER_MANAGER', 'SUPPORT_AGENT', 'SUPPORT_MANAGER'];

// Manual | Round Robin | Least Busy | Team Based | Category Based (future rules)
export const assignOrder = async ({ order, agentId = null, team = '', method = 'MANUAL', actor = null }) => {
  let agent = null;
  if (agentId) {
    agent = await User.findOne({ _id: agentId, isActive: true });
    if (!agent) {
      const err = new Error('Agent not found or inactive');
      err.statusCode = 404;
      throw err;
    }
  } else if (method === 'LEAST_BUSY' || method === 'ROUND_ROBIN') {
    const pool = await User.find({ role: { $in: AGENT_ROLES }, isActive: true }).select('_id');
    if (!pool.length) {
      const err = new Error('No available agents');
      err.statusCode = 400;
      throw err;
    }
    if (method === 'LEAST_BUSY') {
      const counts = await Order.aggregate([
        { $match: { assignedTo: { $in: pool.map((p) => p._id) }, orderStatus: { $nin: ['Delivered', 'DELIVERED', 'Cancelled', 'CANCELLED'] } } },
        { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
      ]);
      const map = new Map(counts.map((c) => [String(c._id), c.count]));
      agent = pool.sort((a, b) => (map.get(String(a._id)) || 0) - (map.get(String(b._id)) || 0))[0];
      agent = await User.findById(agent._id);
    } else {
      const total = await Order.countDocuments();
      agent = await User.findById(pool[total % pool.length]._id);
    }
  }

  order.assignedTo = agent?._id || null;
  if (team !== undefined) order.assignedTeam = team;
  order.assignedAt = new Date();
  order.assignedBy = actor?._id || null;
  await order.save();
  return order;
};

export const unassignOrder = async ({ order }) => {
  order.assignedTo = null;
  order.assignedTeam = '';
  order.assignedAt = null;
  await order.save();
  return order;
};

import User from '../../models/User.js';
import Order from '../../models/Order.js';
import Payment from '../../models/Payment.js';
import Return from '../../models/Return.js';
import SupportTicket from '../../models/SupportTicket.js';
import Conversation from '../../models/Conversation.js';
import CustomerFeedback from '../../models/CustomerFeedback.js';
import CustomerNote from '../../models/CustomerNote.js';

// READ-ONLY aggregator — reuses existing Order/Payment/Return models.
// Support NEVER recalculates financials here; it only displays.
export const customer360 = async (customerId) => {
  const [customer, orders, payments, returns, tickets, conversations, feedback, notes] = await Promise.all([
    User.findById(customerId).select('name email phone role isActive avatar createdAt'),
    Order.find({ customer: customerId }).sort({ createdAt: -1 }).limit(20).select('orderNumber orderStatus paymentStatus totalAmount createdAt'),
    Payment.find({ customer: customerId }).sort({ createdAt: -1 }).limit(20).select('amount status method transactionId createdAt'),
    Return.find({}).populate({ path: 'order', select: 'customer orderNumber' }).then((all) => all.filter((r) => String(r.order?.customer) === String(customerId))).catch(() => []),
    SupportTicket.find({ customer: customerId }).sort({ createdAt: -1 }).limit(20).select('ticketId subject status priority createdAt'),
    Conversation.find({ customer: customerId }).sort({ lastMessageAt: -1 }).limit(20).select('conversationId status lastMessageAt'),
    CustomerFeedback.find({ customer: customerId }).sort({ createdAt: -1 }).limit(10),
    CustomerNote.find({ customer: customerId }).sort({ createdAt: -1 }).limit(20).populate('createdBy', 'name role'),
  ]);

  if (!customer) {
    const err = new Error('Customer not found');
    err.statusCode = 404;
    throw err;
  }

  const totalPurchase = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const openTickets = tickets.filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status)).length;
  const avgRating = feedback.length
    ? Number((feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(2))
    : 0;

  // Mask sensitive fields for non-privileged callers — enforced in controller via permissions
  return {
    profile: customer,
    stats: {
      totalOrders: orders.length,
      totalPurchase,
      totalTickets: tickets.length,
      openTickets,
      resolvedTickets: tickets.length - openTickets,
      returns: returns.length,
      refunds: returns.length,
      complaints: tickets.filter((t) => ['HIGH', 'URGENT'].includes(t.priority)).length,
      satisfaction: avgRating,
    },
    history: { orders, payments, tickets, conversations, returns, feedback },
    internalNotes: notes, // controller strips this unless SUPPORT_* privileged
  };
};

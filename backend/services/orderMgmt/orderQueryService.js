import Order from '../../models/Order.js';
import { searchRegex } from '../../utils/safeRegex.js';

// Advanced search + filters. Case-insensitive partial matching, indexed fields,
// cursor-friendly pagination (page/limit + sort). Delivery-type logic stays in
// Delivery Service — here we only filter on the stored deliveryType snapshot.
export const queryOrders = ({ search, status, paymentStatus, deliveryStatus, deliveryType, paymentMethod, priority, agent, district, area, minValue, maxValue, from, to, page = 1, limit = 20, sort = '-createdAt' }) => {
  const q = {};
  if (status) q.orderStatus = Array.isArray(status) ? { $in: status } : status;
  if (paymentStatus) q.paymentStatus = paymentStatus;
  if (deliveryStatus) q.deliveryStatus = deliveryStatus;
  if (deliveryType) q.deliveryType = deliveryType;
  if (paymentMethod) q.paymentMethod = paymentMethod;
  if (priority) q.priority = priority;
  if (agent) q.assignedTo = agent;
  if (district) q['shippingAddress.city'] = searchRegex(district);
  if (area) q['shippingAddress.area'] = searchRegex(area);
  if (minValue || maxValue) {
    q.totalAmount = {};
    if (minValue) q.totalAmount.$gte = Number(minValue);
    if (maxValue) q.totalAmount.$lte = Number(maxValue);
  }
  if (from || to) {
    q.createdAt = {};
    if (from) q.createdAt.$gte = new Date(from);
    if (to) q.createdAt.$lte = new Date(to);
  }
  if (search) {
    const rx = searchRegex(search);
    q.$or = [
      { orderNumber: rx },
      { trackingId: rx },
      { 'shippingAddress.fullName': rx },
      { 'shippingAddress.phone': rx },
      { 'paymentMeta.paymentID': rx },
      { 'paymentMeta.tranId': rx },
      { 'orderItems.name': rx },
    ];
  }
  const skip = (Number(page) - 1) * Number(limit);
  return Promise.all([
    Order.find(q)
      .populate('customer', 'name phone email')
      .populate('assignedTo', 'name role')
      .populate('assignedRider', 'name phone')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit)),
    Order.countDocuments(q),
  ]);
};

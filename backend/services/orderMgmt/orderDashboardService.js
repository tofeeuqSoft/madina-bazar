import Order from '../../models/Order.js';

const STATUS_GROUPS = {
  newOrders: ['Pending', 'PLACED'],
  pendingVerification: ['Pending', 'PLACED', 'PENDING_VERIFICATION'],
  confirmed: ['Confirmed', 'CONFIRMED'],
  processing: ['Processing', 'PROCESSING'],
  readyToShip: ['Ready for Delivery', 'READY_TO_SHIP'],
  shipped: ['Shipped', 'SHIPPED'],
  outForDelivery: ['Out for Delivery', 'OUT_FOR_DELIVERY'],
  delivered: ['Delivered', 'DELIVERED'],
  onHold: ['ON_HOLD'],
  cancelled: ['Cancelled', 'CANCELLED'],
  failed: ['FAILED'],
};

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const orderDashboard = async () => {
  const today = startOfDay();
  const count = (statuses) => Order.countDocuments({ orderStatus: { $in: statuses } });

  const [
    total, todays, pendingVerification, confirmed, processing, readyToShip,
    shipped, outForDelivery, delivered, cancelled, failed, onHold,
    unassigned, highPriority, urgent, cod, onlinePaid, salesAgg, grocery, nationwide, mixed,
  ] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({ createdAt: { $gte: today } }),
    count(STATUS_GROUPS.pendingVerification),
    count(STATUS_GROUPS.confirmed),
    count(STATUS_GROUPS.processing),
    count(STATUS_GROUPS.readyToShip),
    count(STATUS_GROUPS.shipped),
    count(STATUS_GROUPS.outForDelivery),
    count(STATUS_GROUPS.delivered),
    count(STATUS_GROUPS.cancelled),
    count(STATUS_GROUPS.failed),
    count(STATUS_GROUPS.onHold),
    Order.countDocuments({ assignedTo: null, orderStatus: { $nin: ['Delivered', 'DELIVERED', 'Cancelled', 'CANCELLED'] } }),
    Order.countDocuments({ priority: 'HIGH', orderStatus: { $nin: ['Delivered', 'DELIVERED', 'Cancelled', 'CANCELLED'] } }),
    Order.countDocuments({ priority: 'URGENT', orderStatus: { $nin: ['Delivered', 'DELIVERED', 'Cancelled', 'CANCELLED'] } }),
    Order.countDocuments({ paymentMethod: 'COD' }),
    Order.countDocuments({ paymentMethod: { $ne: 'COD' }, paymentStatus: 'Paid' }),
    Order.aggregate([
      { $match: { createdAt: { $gte: today } } },
      { $group: { _id: null, sales: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
    Order.countDocuments({ deliveryType: 'GROCERY' }),
    Order.countDocuments({ deliveryType: 'NATIONWIDE' }),
    Order.countDocuments({ deliveryType: 'MIXED' }),
  ]);

  const todaySales = salesAgg[0]?.sales || 0;
  const todayCount = salesAgg[0]?.count || 0;

  return {
    totalOrders: total,
    todaysOrders: todays,
    pendingVerification,
    confirmed,
    processing,
    readyToShip,
    shipped,
    outForDelivery,
    delivered,
    cancelled,
    failed,
    onHold,
    unassignedOrders: unassigned,
    highPriorityOrders: highPriority,
    urgentOrders: urgent,
    codOrders: cod,
    onlinePaidOrders: onlinePaid,
    todaysSales: todaySales,
    averageOrderValue: todayCount ? Number((todaySales / todayCount).toFixed(2)) : 0,
    groceryOrders: grocery,
    nationwideOrders: nationwide,
    mixedOrders: mixed,
  };
};

export const orderReports = async ({ from, to }) => {
  const match = {};
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }
  const [byStatus, byPayment, byDeliveryType, totals] = await Promise.all([
    Order.aggregate([{ $match: match }, { $group: { _id: '$orderStatus', count: { $sum: 1 }, sales: { $sum: '$totalAmount' } } }]),
    Order.aggregate([{ $match: match }, { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }]),
    Order.aggregate([{ $match: match }, { $group: { _id: '$deliveryType', count: { $sum: 1 } } }]),
    Order.aggregate([{ $match: match }, { $group: { _id: null, count: { $sum: 1 }, sales: { $sum: '$totalAmount' } } }]),
  ]);
  return { byStatus, byPayment, byDeliveryType, totals: totals[0] || { count: 0, sales: 0 } };
};

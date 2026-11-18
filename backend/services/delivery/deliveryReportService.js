import Shipment from '../../models/Shipment.js';
import Order from '../../models/Order.js';
import Rider from '../../models/Rider.js';
import CourierProvider from '../../models/CourierProvider.js';
import { networkFootprint } from './coverageService.js';

const dayStart = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const deliveryDashboard = async () => {
  const [
    totalOrders, ownCount, extCount, pendingAssign, outForDelivery, delivered, failed, returned,
    activeRiders, providers, footprint, riders,
  ] = await Promise.all([
    Order.countDocuments(),
    Shipment.countDocuments({ deliveryMode: 'OWN_DELIVERY' }),
    Shipment.countDocuments({ deliveryMode: 'EXTERNAL_COURIER' }),
    Shipment.countDocuments({ status: { $in: ['CREATED', 'PENDING_ASSIGNMENT'] } }),
    Shipment.countDocuments({ status: 'OUT_FOR_DELIVERY' }),
    Shipment.countDocuments({ status: 'DELIVERED' }),
    Shipment.countDocuments({ status: 'FAILED' }),
    Shipment.countDocuments({ status: { $in: ['RETURN_REQUESTED', 'RETURNED'] } }),
    Rider.countDocuments({ status: 'ACTIVE', isAvailable: true }),
    CourierProvider.find({}).select('code status priority successRate'),
    networkFootprint(),
    Rider.find({ status: 'ACTIVE' }).select('totalDelivered totalFailed'),
  ]);

  const totalShip = ownCount + extCount;
  const ownSuccess = await Shipment.countDocuments({ deliveryMode: 'OWN_DELIVERY', status: 'DELIVERED' });
  const extSuccess = await Shipment.countDocuments({ deliveryMode: 'EXTERNAL_COURIER', status: 'DELIVERED' });
  const ownDone = await Shipment.countDocuments({ deliveryMode: 'OWN_DELIVERY', status: { $in: ['DELIVERED', 'FAILED'] } });
  const extDone = await Shipment.countDocuments({ deliveryMode: 'EXTERNAL_COURIER', status: { $in: ['DELIVERED', 'FAILED'] } });

  const totalCod = await Shipment.aggregate([
    { $match: { codAmount: { $gt: 0 }, codSettled: false } },
    { $group: { _id: null, pending: { $sum: '$collectedAmount' }, count: { $sum: 1 } } },
  ]);
  const todayCod = await Shipment.aggregate([
    { $match: { createdAt: { $gte: dayStart() }, codAmount: { $gt: 0 } } },
    { $group: { _id: null, amount: { $sum: '$codAmount' } } },
  ]);

  const eligible = totalShip; // every shipped order was delivery-eligible
  return {
    totals: { totalOrders, ownDeliveryOrders: ownCount, externalCourierOrders: extCount },
    network: {
      ...footprint,
      activeRiders,
      ownCoveragePct: eligible ? Number(((ownCount / eligible) * 100).toFixed(1)) : 0,
      ownOrderSharePct: eligible ? Number(((ownCount / eligible) * 100).toFixed(1)) : 0,
      externalDependencyPct: eligible ? Number(((extCount / eligible) * 100).toFixed(1)) : 0,
    },
    flow: { pendingAssignment: pendingAssign, outForDelivery, delivered, failed, returned },
    cod: { today: todayCod[0]?.amount || 0, pendingSettlement: totalCod[0]?.pending || 0, pendingCount: totalCod[0]?.count || 0 },
    performance: {
      ownSuccessRate: ownDone ? Number(((ownSuccess / ownDone) * 100).toFixed(1)) : 0,
      externalSuccessRate: extDone ? Number(((extSuccess / extDone) * 100).toFixed(1)) : 0,
      riderDelivered: riders.reduce((s, r) => s + (r.totalDelivered || 0), 0),
      riderFailed: riders.reduce((s, r) => s + (r.totalFailed || 0), 0),
    },
    providers,
  };
};

// Month-over-month own-network growth (coverage expansion KPI)
export const networkGrowth = async () => {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const [own, total] = await Promise.all([
      Shipment.countDocuments({ deliveryMode: 'OWN_DELIVERY', createdAt: { $gte: start, $lt: end } }),
      Shipment.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    ]);
    months.push({
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      own,
      total,
      ownPct: total ? Number(((own / total) * 100).toFixed(1)) : 0,
    });
  }
  return months;
};

export const courierPerformance = async () => {
  const rows = await Shipment.aggregate([
    { $match: { deliveryMode: 'EXTERNAL_COURIER' } },
    { $group: { _id: '$provider', count: { $sum: 1 }, delivered: { $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] } }, margin: { $sum: '$deliveryMargin' } } },
  ]);
  const providers = await CourierProvider.find({}).lean();
  return rows.map((r) => ({ ...r, config: providers.find((p) => p.code === r._id) || null }));
};

export const ownPerformance = async () => {
  const riders = await Rider.find({}).populate('user', 'name phone').populate('assignedZones', 'name');
  return riders.map((r) => ({
    name: r.user?.name, phone: r.user?.phone, zones: (r.assignedZones || []).map((z) => z.name),
    delivered: r.totalDelivered, failed: r.totalFailed, codCollected: r.totalCodCollected,
    successRate: r.totalDelivered + r.totalFailed ? Number(((r.totalDelivered / (r.totalDelivered + r.totalFailed)) * 100).toFixed(1)) : 0,
  }));
};

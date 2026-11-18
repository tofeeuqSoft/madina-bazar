import Shipment from '../../models/Shipment.js';
import { logAudit } from '../../utils/auditLog.js';

// COD lifecycle: collect (rider/courier) → settle (admin). Money movement
// itself stays in Payment/Accounting services — this tracks delivery-side state.
export const codSummary = async ({ from, to } = {}) => {
  const match = {};
  if (from || to) match.createdAt = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
  const rows = await Shipment.aggregate([
    { $match: { ...match, codAmount: { $gt: 0 } } },
    { $group: { _id: '$codSettled', cod: { $sum: '$codAmount' }, collected: { $sum: '$collectedAmount' }, count: { $sum: 1 } } },
  ]);
  const settled = rows.find((r) => r._id === true) || { cod: 0, collected: 0, count: 0 };
  const pending = rows.find((r) => r._id !== true) || { cod: 0, collected: 0, count: 0 };
  return { settled, pendingSettlement: pending };
};

export const settleCod = async ({ shipmentId, actor = null, req = null, acceptVariance = false } = {}) => {
  const s = await Shipment.findById(shipmentId);
  if (!s) {
    const e = new Error('Shipment not found');
    e.statusCode = 404;
    throw e;
  }
  if (s.codSettled) return s;
  const RiderCODCollection = (await import('../../models/RiderCODCollection.js')).default;
  const c = await RiderCODCollection.findOne({ shipment: s._id });
  if (c) {
    if (c.status === 'PENDING' || (c.submittedAmount || 0) <= 0) {
      throw Object.assign(new Error('Rider has not submitted cash yet — cannot settle'), { statusCode: 400, code: 'COD_NOT_SUBMITTED' });
    }
    if (c.variance < 0 && !acceptVariance) {
      throw Object.assign(new Error(`Short cash ৳${Math.abs(c.variance)} — resolve (recover from rider) or explicitly accept the shortage`), { statusCode: 400, code: 'COD_SHORT_CASH' });
    }
    c.status = 'SETTLED';
    c.settledAt = new Date();
    c.shortageAbsorbed = c.variance < 0 ? Math.abs(c.variance) : 0;
    await c.save();
  }
  s.codSettled = true;
  await s.save();
  try {
    logAudit(req, { action: 'COD_SETTLED', entity: 'Shipment', entityId: s._id, entityName: s.shipmentNo, details: { amount: s.collectedAmount, submitted: c?.submittedAmount || 0, shortageAbsorbed: c?.shortageAbsorbed || 0, varianceAccepted: !!acceptVariance } });
  } catch (_) {}
  return s;
};

export const marginReport = async ({ from, to } = {}) => {
  const match = {};
  if (from || to) match.createdAt = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
  const rows = await Shipment.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$deliveryMode',
        revenue: { $sum: '$customerDeliveryCharge' },
        cost: { $sum: '$actualDeliveryCost' },
        margin: { $sum: '$deliveryMargin' },
        count: { $sum: 1 },
      },
    },
  ]);
  return rows;
};

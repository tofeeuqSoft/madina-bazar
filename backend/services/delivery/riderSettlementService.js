import RiderSettlement from '../../models/RiderSettlement.js';
import RiderCODCollection from '../../models/RiderCODCollection.js';
import RiderDeliveryAttempt from '../../models/RiderDeliveryAttempt.js';
import Settings from '../../models/Settings.js';
import { logAudit } from '../../utils/auditLog.js';

// Compensation preview: FIXED_SALARY | PER_DELIVERY | ZONE_BASED | MIXED.
// Earnings are rider pay — NEVER customer delivery charges.
export const previewSettlement = async ({ riderId, from, to, model = null, perDeliveryRate = 0, baseAmount = 0 }) => {
  const settings = (await Settings.findOne()) || {};
  const m = model || settings.riderPayModel || 'PER_DELIVERY';
  const rate = perDeliveryRate || settings.riderPerDeliveryRate || 20;
  const base = baseAmount || settings.riderBaseSalary || 0;

  const delivered = await RiderDeliveryAttempt.countDocuments({
    rider: riderId, outcome: 'DELIVERED', createdAt: { $gte: new Date(from), $lte: new Date(to) },
  });
  const mongoose = (await import('mongoose')).default;
  const codVariance = await RiderCODCollection.aggregate([
    { $match: { rider: new mongoose.Types.ObjectId(String(riderId)) } },
    { $group: { _id: null, variance: { $sum: '$variance' } } },
  ]).catch(() => []);

  const incentive = m === 'PER_DELIVERY' || m === 'MIXED' ? delivered * rate : 0;
  const total = (m === 'FIXED_SALARY' ? base : m === 'PER_DELIVERY' ? incentive : base + incentive);
  return {
    model: m, deliveries: delivered, baseAmount: base, perDeliveryRate: rate,
    incentive, totalAmount: total, codVariance: codVariance[0]?.variance || 0,
  };
};

export const createSettlement = async ({ riderId, from, to, model, perDeliveryRate, baseAmount, actor = null, req = null }) => {
  const preview = await previewSettlement({ riderId, from, to, model, perDeliveryRate, baseAmount });
  const settlement = await RiderSettlement.create({
    rider: riderId,
    periodFrom: new Date(from),
    periodTo: new Date(to),
    model: preview.model,
    deliveries: preview.deliveries,
    baseAmount: preview.baseAmount,
    perDeliveryRate: preview.perDeliveryRate,
    incentive: preview.incentive,
    totalAmount: preview.totalAmount,
    codVariance: preview.codVariance,
  });
  try {
    logAudit(req, { action: 'RIDER_SETTLEMENT_CREATED', entity: 'RiderSettlement', entityId: settlement._id, details: { riderId, total: preview.totalAmount } });
  } catch (_) {}
  return settlement;
};

export const approveSettlement = async ({ settlementId, actor = null, req = null }) => {
  const s = await RiderSettlement.findById(settlementId);
  if (!s) {
    const e = new Error('Settlement not found');
    e.statusCode = 404;
    throw e;
  }
  if (s.codVariance < 0 && req?.body?.force !== true) {
    const e = new Error('Negative COD variance requires review — pass force:true to override');
    e.statusCode = 400;
    e.code = 'SETTLEMENT_VARIANCE_REVIEW';
    throw e;
  }
  s.status = 'APPROVED';
  s.approvedBy = actor?._id || null;
  await s.save();
  return s;
};

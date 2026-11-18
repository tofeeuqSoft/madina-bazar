import Shipment from '../../models/Shipment.js';
import { transitionShipment } from './shipmentService.js';
import { logAudit } from '../../utils/auditLog.js';

// RTO loop: failed deliveries get limited re-attempts, then goods come back.
//   retry → attempt+1 while failedCount < MAX (default 3)
//   stuck FAILED older than X days (default 3) → RETURN_REQUESTED auto + audit
// Sweep uses failedAt, falling back to updatedAt for pre-feature rows.
const MAX_ATTEMPTS = Number(process.env.RTO_MAX_ATTEMPTS || 3);
const AUTO_RETURN_DAYS = Number(process.env.RTO_AUTO_RETURN_DAYS || 3);

export const failedCountForOrder = (orderId) =>
  Shipment.countDocuments({ order: orderId, status: 'FAILED' });

export const assertRetryAllowed = async (orderId) => {
  const failed = await failedCountForOrder(orderId);
  if (failed >= MAX_ATTEMPTS) {
    const e = new Error(`Max delivery attempts reached (${MAX_ATTEMPTS} failed) — return to origin instead`);
    e.statusCode = 400;
    e.code = 'RTO_MAX_ATTEMPTS';
    throw e;
  }
  return { failed, remaining: MAX_ATTEMPTS - failed };
};

export const requestReturnToOrigin = async ({ shipment, actor = null, note = '', req = null }) => {
  const s = typeof shipment === 'object' ? shipment : await Shipment.findById(shipment);
  if (!s) throw Object.assign(new Error('Shipment not found'), { statusCode: 404 });
  if (!['FAILED', 'RETURN_REQUESTED'].includes(s.status)) {
    throw Object.assign(new Error(`RTO only from FAILED (now ${s.status})`), { statusCode: 400, code: 'RTO_INVALID_STATUS' });
  }
  if (s.status === 'FAILED') {
    await transitionShipment({ shipment: s, status: 'RETURN_REQUESTED', actor, note: note || 'Return to origin', req });
    s.rtoAt = new Date();
    await s.save().catch(() => {});
  }
  try {
    logAudit(req, { action: 'SHIPMENT_RTO', entity: 'Shipment', entityId: s._id, entityName: s.shipmentNo, details: { note }, ip: req?.ip || '' });
  } catch (_) {}
  return s;
};

export const sweepRto = async ({ limit = 100 } = {}) => {
  const cutoff = new Date(Date.now() - AUTO_RETURN_DAYS * 86400000);
  const stuck = await Shipment.find({
    status: 'FAILED',
    $or: [{ failedAt: { $lt: cutoff } }, { failedAt: null, updatedAt: { $lt: cutoff } }],
  }).sort({ updatedAt: 1 }).limit(limit);
  const report = { checked: stuck.length, returned: 0, errors: [] };
  for (const s of stuck) {
    try {
      await requestReturnToOrigin({ shipment: s, actor: null, note: `Auto-RTO: failed over ${AUTO_RETURN_DAYS}d ago`, req: null });
      report.returned += 1;
    } catch (e) {
      report.errors.push({ shipment: String(s._id), error: e.message });
    }
  }
  return report;
};

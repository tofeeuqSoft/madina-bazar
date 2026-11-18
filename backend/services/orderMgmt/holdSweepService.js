import Order from '../../models/Order.js';
import { assertTransition } from './orderStatusService.js';
import { logOrderAction } from './orderAuditService.js';

// Expired holds auto-release: an order must never stick on hold forever.
// Resumes prevStatus when the transition is legal, else PENDING_VERIFICATION
// (human triage). Best-effort SMS to the customer on resume.
export const sweepExpiredHolds = async ({ limit = 100 } = {}) => {
  const stuck = await Order.find({
    orderStatus: 'ON_HOLD',
    'hold.isHeld': true,
    'hold.expiresAt': { $lt: new Date() },
  }).sort({ 'hold.expiresAt': 1 }).limit(limit);
  const report = { checked: stuck.length, resumed: 0, errors: [] };
  for (const order of stuck) {
    try {
      let next = 'PENDING_VERIFICATION';
      try {
        next = assertTransition('ON_HOLD', order.hold?.prevStatus || '');
      } catch (_) {
        next = 'PENDING_VERIFICATION';
      }
      order.orderStatus = next;
      order.hold.isHeld = false;
      order.statusHistory.push({ status: next, changedBy: null, note: `Hold expired — auto-resumed from ${order.hold?.reason || 'hold'}`, timestamp: new Date() });
      await order.save();
      await logOrderAction({ order, action: 'ORDER_HOLD_EXPIRED', actor: null, oldValue: { status: 'ON_HOLD' }, newValue: { status: next }, reason: 'Auto-release' });
      try {
        const phone = order.shippingAddress?.phone;
        if (phone) {
          const { sendSMS } = await import('../../utils/notifications.js');
          await sendSMS({ to: phone, message: `[MadinaBazar] Order ${order.orderNumber} is moving again — we will update you shortly.` });
        }
      } catch (e) {
        console.error('[hold-sms]', e.message);
      }
      report.resumed += 1;
    } catch (e) {
      report.errors.push({ order: String(order._id), error: e.message });
    }
  }
  return report;
};

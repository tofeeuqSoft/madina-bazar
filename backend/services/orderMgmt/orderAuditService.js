import OrderAuditLog from '../../models/OrderAuditLog.js';

export const logOrderAction = async ({ order, action, actor = null, oldValue = null, newValue = null, reason = '', metadata = {}, ip = '' }) => {
  try {
    await OrderAuditLog.create({
      order: order._id || order,
      orderNumber: order.orderNumber || '',
      action,
      actor: actor?._id || actor || null,
      actorRole: actor?.role || '',
      oldValue,
      newValue,
      reason,
      metadata,
      ip,
    });
  } catch (e) {
    console.error('order audit failed:', e.message);
  }
};

// Frontend mirror of backend RBAC — sidebar + route guards.
// SUPER_ADMIN bypasses everything. Custom user.permissions merge over role defaults.

const ROLE_PERMS = {
  SUPER_ADMIN: ['*'],
  SUB_ADMIN: [],
  ORDER_MANAGER: [
    'ORDER_VIEW', 'ORDER_UPDATE', 'ORDER_CANCEL', 'ORDER_ASSIGN_RIDER',
    'CUSTOMER_VIEW', 'INVOICE_VIEW',
    'order.search', 'order.filter', 'order.confirm', 'order.process',
    'order.assign', 'order.unassign', 'order.status.update', 'order.priority.update',
    'order.customer.edit', 'order.address.edit', 'order.cancel', 'order.hold',
    'order.reopen', 'order.note.create', 'order.note.view', 'order.communication.send',
    'order.report.view', 'order.report.export', 'order.audit.view',
    'order.payment.view', 'order.financial.view', 'order.refund.request',
    'delivery.view', 'delivery.shipment.view', 'delivery.tracking.view',
  ],
  SUPPORT_MANAGER: ['SUPPORT_VIEW', 'SUPPORT_REPLY', 'SUPPORT_ASSIGN', 'ORDER_VIEW'],
  SUPPORT_AGENT: ['SUPPORT_VIEW', 'SUPPORT_REPLY', 'ORDER_VIEW'],
  DELIVERY_RIDER: ['ORDER_VIEW', 'delivery.view', 'delivery.shipment.view', 'delivery.tracking.view', 'delivery.rider.view'],
  DELIVERY_MANAGER: [
    'ORDER_VIEW', 'ORDER_UPDATE', 'ORDER_ASSIGN_RIDER', 'REPORT_VIEW',
    'delivery.view', 'delivery.zone.view', 'delivery.zone.create', 'delivery.zone.update',
    'delivery.zone.delete', 'delivery.zone.activate', 'delivery.rider.view', 'delivery.rider.create',
    'delivery.rider.update', 'delivery.rider.assign', 'delivery.shipment.view', 'delivery.shipment.create',
    'delivery.shipment.cancel', 'delivery.shipment.retry', 'delivery.courier.view', 'delivery.courier.manage',
    'delivery.courier.activate', 'delivery.courier.configure', 'delivery.tracking.view',
    'delivery.settlement.view', 'delivery.report.view', 'delivery.report.export', 'delivery.audit.view',
  ],
  INVENTORY_MANAGER: [
    'inventory.view', 'inventory.stock.view', 'inventory.stock.adjust',
    'inventory.reservation.view', 'inventory.reservation.create', 'inventory.reservation.release',
    'inventory.movement.view', 'inventory.warehouse.view', 'inventory.warehouse.create',
    'inventory.warehouse.update', 'inventory.transfer.view', 'inventory.transfer.create',
    'inventory.transfer.receive', 'inventory.purchase.receive', 'inventory.return.view',
    'inventory.return.inspect', 'inventory.return.restock', 'inventory.batch.view',
    'inventory.batch.create', 'inventory.batch.update', 'inventory.expiry.view',
    'inventory.expiry.manage', 'inventory.damage.view', 'inventory.damage.create',
    'inventory.loss.create', 'inventory.valuation.view', 'inventory.alert.view',
    'inventory.alert.manage', 'inventory.report.view', 'inventory.report.export',
    'inventory.audit.view', 'inventory.settings.view',
    'product.import', 'product.bulk_edit',
    'PRODUCT_VIEW', 'ORDER_VIEW', 'RETURN_VIEW', 'PURCHASE_VIEW', 'SUPPLIER_VIEW',
  ],
  ACCOUNTANT: ['ORDER_VIEW', 'PAYMENT_VIEW', 'REPORT_VIEW'],
  DELIVERY_SUPPORT: ['SUPPORT_VIEW', 'ORDER_VIEW'],
  PAYMENT_SUPPORT: ['SUPPORT_VIEW', 'ORDER_VIEW', 'PAYMENT_VIEW'],
  REFUND_MANAGER: ['SUPPORT_VIEW', 'ORDER_VIEW'],
  AI_MANAGER: ['SUPPORT_VIEW'],
  CUSTOMER: [],
};

export const can = (user, ...perms) => {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.permissions?.includes('*')) return true;
  const effective = new Set([...(ROLE_PERMS[user.role] || []), ...(user.permissions || [])]);
  return perms.some((p) => effective.has(p));
};

export const canViewOrders = (user) => can(user, 'ORDER_VIEW', 'order.search', 'order.filter');

export default { can, canViewOrders };

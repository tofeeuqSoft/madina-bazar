/**
 * Madina Bazar - Complete Permission List
 * Used for RBAC Policy
 */

export const ALL_PERMISSIONS = {
  // ========== PRODUCT ==========
  PRODUCT_VIEW: 'PRODUCT_VIEW',
  PRODUCT_CREATE: 'PRODUCT_CREATE',
  PRODUCT_UPDATE: 'PRODUCT_UPDATE',
  PRODUCT_DELETE: 'PRODUCT_DELETE',
  PRODUCT_STATUS: 'PRODUCT_STATUS', // Enable/Disable

  // ========== CATEGORY ==========
  CATEGORY_VIEW: 'CATEGORY_VIEW',
  CATEGORY_CREATE: 'CATEGORY_CREATE',
  CATEGORY_UPDATE: 'CATEGORY_UPDATE',
  CATEGORY_DELETE: 'CATEGORY_DELETE',

  // ========== COMBO ==========
  COMBO_VIEW: 'COMBO_VIEW',
  COMBO_CREATE: 'COMBO_CREATE',
  COMBO_UPDATE: 'COMBO_UPDATE',
  COMBO_DELETE: 'COMBO_DELETE',

  // ========== ORDER ==========
  ORDER_VIEW: 'ORDER_VIEW',
  ORDER_CREATE: 'ORDER_CREATE',
  ORDER_UPDATE: 'ORDER_UPDATE',
  ORDER_CANCEL: 'ORDER_CANCEL',
  ORDER_ASSIGN_RIDER: 'ORDER_ASSIGN_RIDER',

  // ========== INVENTORY ==========
  INVENTORY_VIEW: 'INVENTORY_VIEW',
  INVENTORY_UPDATE: 'INVENTORY_UPDATE',

  // ========== CUSTOMER ==========
  CUSTOMER_VIEW: 'CUSTOMER_VIEW',
  CUSTOMER_UPDATE: 'CUSTOMER_UPDATE',
  CUSTOMER_DISABLE: 'CUSTOMER_DISABLE',

  // ========== DELIVERY ==========
  DELIVERY_AREA_VIEW: 'DELIVERY_AREA_VIEW',
  DELIVERY_AREA_CREATE: 'DELIVERY_AREA_CREATE',
  DELIVERY_AREA_UPDATE: 'DELIVERY_AREA_UPDATE',
  DELIVERY_AREA_DISABLE: 'DELIVERY_AREA_DISABLE',
  RIDER_VIEW: 'RIDER_VIEW',
  RIDER_ASSIGN: 'RIDER_ASSIGN',

  // ========== PAYMENT ==========
  PAYMENT_VIEW: 'PAYMENT_VIEW',
  PAYMENT_SETTINGS: 'PAYMENT_SETTINGS',
  PAYMENT_REPORT: 'PAYMENT_REPORT',

  // ========== COUPON ==========
  COUPON_VIEW: 'COUPON_VIEW',
  COUPON_CREATE: 'COUPON_CREATE',
  COUPON_UPDATE: 'COUPON_UPDATE',
  COUPON_DELETE: 'COUPON_DELETE',

  // ========== REPORT ==========
  REPORT_VIEW: 'REPORT_VIEW',
  REPORT_SALES: 'REPORT_SALES',
  REPORT_INVENTORY: 'REPORT_INVENTORY',
  REPORT_PURCHASE: 'REPORT_PURCHASE',
  REPORT_EXPENSE: 'REPORT_EXPENSE',
  REPORT_FINANCIAL: 'REPORT_FINANCIAL', // P&L, Balance Sheet, Cash Flow
  REPORT_PROFIT: 'REPORT_PROFIT', // COGS, Gross, Net
  REPORT_DUE: 'REPORT_DUE', // Customer / Supplier due
  REPORT_TAX: 'REPORT_TAX',
  REPORT_RETURN: 'REPORT_RETURN', // Return / Refund

  // ========== FINANCE DATA ==========
  PURCHASE_VIEW: 'PURCHASE_VIEW',
  PURCHASE_CREATE: 'PURCHASE_CREATE',
  PURCHASE_UPDATE: 'PURCHASE_UPDATE',
  PURCHASE_DELETE: 'PURCHASE_DELETE',
  EXPENSE_VIEW: 'EXPENSE_VIEW',
  EXPENSE_CREATE: 'EXPENSE_CREATE',
  EXPENSE_UPDATE: 'EXPENSE_UPDATE',
  EXPENSE_DELETE: 'EXPENSE_DELETE',
  SUPPLIER_VIEW: 'SUPPLIER_VIEW',
  SUPPLIER_CREATE: 'SUPPLIER_CREATE',
  SUPPLIER_UPDATE: 'SUPPLIER_UPDATE',
  SUPPLIER_DELETE: 'SUPPLIER_DELETE',
  RETURN_VIEW: 'RETURN_VIEW',
  RETURN_CREATE: 'RETURN_CREATE',
  RETURN_UPDATE: 'RETURN_UPDATE',
  RETURN_DELETE: 'RETURN_DELETE',

  // ========== USER & STAFF ==========
  USER_VIEW: 'USER_VIEW',
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DISABLE: 'USER_DISABLE',
  STAFF_CREATE: 'STAFF_CREATE',
  STAFF_UPDATE: 'STAFF_UPDATE',
  PERMISSION_MANAGE: 'PERMISSION_MANAGE',

  // ========== SETTINGS ==========
  SETTINGS_VIEW: 'SETTINGS_VIEW',
  SETTINGS_UPDATE: 'SETTINGS_UPDATE',

  // ========== ACCOUNTING ==========
  ACCOUNTING_VIEW: 'ACCOUNTING_VIEW',
  ACCOUNTING_MANAGE: 'ACCOUNTING_MANAGE',

  // ========== INVOICE ==========
  INVOICE_VIEW: 'INVOICE_VIEW',
  INVOICE_DOWNLOAD: 'INVOICE_DOWNLOAD',

  // ========== ORDER MANAGEMENT (ORDER_MANAGER, dot-notation policy) ==========
  ORDER_VIEW_SENSITIVE: 'order.view_sensitive',
  ORDER_SEARCH: 'order.search',
  ORDER_FILTER: 'order.filter',
  ORDER_CONFIRM: 'order.confirm',
  ORDER_PROCESS: 'order.process',
  ORDER_ASSIGN: 'order.assign',
  ORDER_UNASSIGN: 'order.unassign',
  ORDER_STATUS_UPDATE: 'order.status.update',
  ORDER_PRIORITY_UPDATE: 'order.priority.update',
  ORDER_CUSTOMER_EDIT: 'order.customer.edit',
  ORDER_ADDRESS_EDIT: 'order.address.edit',
  ORDER_ITEM_EDIT: 'order.item.edit',
  ORDER_MGMT_CANCEL: 'order.cancel',
  ORDER_HOLD: 'order.hold',
  ORDER_REOPEN: 'order.reopen',
  ORDER_NOTE_CREATE: 'order.note.create',
  ORDER_NOTE_VIEW: 'order.note.view',
  ORDER_COMM_SEND: 'order.communication.send',
  ORDER_REPORT_VIEW: 'order.report.view',
  ORDER_REPORT_EXPORT: 'order.report.export',
  ORDER_AUDIT_VIEW: 'order.audit.view',
  ORDER_PAYMENT_VIEW: 'order.payment.view',
  ORDER_FINANCIAL_VIEW: 'order.financial.view',
  ORDER_REFUND_REQUEST: 'order.refund.request',

  // ========== INVENTORY MANAGEMENT (INVENTORY_MANAGER) ==========
  INVENTORY_VIEW_MGMT: 'inventory.view',
  INVENTORY_STOCK_VIEW: 'inventory.stock.view',
  INVENTORY_STOCK_ADJUST: 'inventory.stock.adjust',
  INVENTORY_STOCK_ADJUST_APPROVE: 'inventory.stock.adjust.approve',
  INVENTORY_RESERVATION_VIEW: 'inventory.reservation.view',
  INVENTORY_RESERVATION_CREATE: 'inventory.reservation.create',
  INVENTORY_RESERVATION_RELEASE: 'inventory.reservation.release',
  INVENTORY_MOVEMENT_VIEW: 'inventory.movement.view',
  INVENTORY_WAREHOUSE_VIEW: 'inventory.warehouse.view',
  INVENTORY_WAREHOUSE_CREATE: 'inventory.warehouse.create',
  INVENTORY_WAREHOUSE_UPDATE: 'inventory.warehouse.update',
  INVENTORY_WAREHOUSE_DELETE: 'inventory.warehouse.delete',
  INVENTORY_TRANSFER_VIEW: 'inventory.transfer.view',
  INVENTORY_TRANSFER_CREATE: 'inventory.transfer.create',
  INVENTORY_TRANSFER_APPROVE: 'inventory.transfer.approve',
  INVENTORY_TRANSFER_RECEIVE: 'inventory.transfer.receive',
  INVENTORY_TRANSFER_CANCEL: 'inventory.transfer.cancel',
  INVENTORY_PURCHASE_RECEIVE: 'inventory.purchase.receive',
  INVENTORY_RETURN_VIEW: 'inventory.return.view',
  INVENTORY_RETURN_INSPECT: 'inventory.return.inspect',
  INVENTORY_RETURN_RESTOCK: 'inventory.return.restock',
  INVENTORY_BATCH_VIEW: 'inventory.batch.view',
  INVENTORY_BATCH_CREATE: 'inventory.batch.create',
  INVENTORY_BATCH_UPDATE: 'inventory.batch.update',
  INVENTORY_EXPIRY_VIEW: 'inventory.expiry.view',
  INVENTORY_EXPIRY_MANAGE: 'inventory.expiry.manage',
  INVENTORY_DAMAGE_VIEW: 'inventory.damage.view',
  INVENTORY_DAMAGE_CREATE: 'inventory.damage.create',
  INVENTORY_LOSS_CREATE: 'inventory.loss.create',
  INVENTORY_VALUATION_VIEW: 'inventory.valuation.view',
  INVENTORY_ALERT_VIEW: 'inventory.alert.view',
  INVENTORY_ALERT_MANAGE: 'inventory.alert.manage',
  INVENTORY_REPORT_VIEW: 'inventory.report.view',
  INVENTORY_REPORT_EXPORT: 'inventory.report.export',
  INVENTORY_AUDIT_VIEW: 'inventory.audit.view',
  INVENTORY_SETTINGS_VIEW: 'inventory.settings.view',
  INVENTORY_SETTINGS_UPDATE: 'inventory.settings.update',

  // ========== DELIVERY NETWORK (zone-driven hybrid) ==========
  DELIVERY_VIEW: 'delivery.view',
  DELIVERY_ZONE_VIEW: 'delivery.zone.view',
  DELIVERY_ZONE_CREATE: 'delivery.zone.create',
  DELIVERY_ZONE_UPDATE: 'delivery.zone.update',
  DELIVERY_ZONE_DELETE: 'delivery.zone.delete',
  DELIVERY_ZONE_ACTIVATE: 'delivery.zone.activate',
  DELIVERY_RIDER_VIEW: 'delivery.rider.view',
  DELIVERY_RIDER_CREATE: 'delivery.rider.create',
  DELIVERY_RIDER_UPDATE: 'delivery.rider.update',
  DELIVERY_RIDER_ASSIGN: 'delivery.rider.assign',
  DELIVERY_SHIPMENT_VIEW: 'delivery.shipment.view',
  DELIVERY_SHIPMENT_CREATE: 'delivery.shipment.create',
  DELIVERY_SHIPMENT_CANCEL: 'delivery.shipment.cancel',
  DELIVERY_SHIPMENT_RETRY: 'delivery.shipment.retry',
  DELIVERY_COURIER_VIEW: 'delivery.courier.view',
  DELIVERY_COURIER_MANAGE: 'delivery.courier.manage',
  DELIVERY_COURIER_ACTIVATE: 'delivery.courier.activate',
  DELIVERY_COURIER_CONFIGURE: 'delivery.courier.configure',
  DELIVERY_TRACKING_VIEW: 'delivery.tracking.view',
  DELIVERY_SETTLEMENT_VIEW: 'delivery.settlement.view',
  DELIVERY_REPORT_VIEW: 'delivery.report.view',
  DELIVERY_REPORT_EXPORT: 'delivery.report.export',
  DELIVERY_AUDIT_VIEW: 'delivery.audit.view',

  // ========== MARKETING MANAGEMENT (read-only analytics) ==========
  MARKETING_VIEW: 'marketing.view',
  MARKETING_REPORT_VIEW: 'marketing.report.view',
  MARKETING_EXPORT: 'marketing.export',

  // ========== CATALOG BULK (inventory-side product maintenance) ==========
  PRODUCT_IMPORT: 'product.import',
  PRODUCT_BULK_EDIT: 'product.bulk_edit',

  // ========== SUPPORT ==========
  SUPPORT_VIEW: 'SUPPORT_VIEW',
  SUPPORT_REPLY: 'SUPPORT_REPLY',
  SUPPORT_ASSIGN: 'SUPPORT_ASSIGN',
  SUPPORT_CUSTOMER_VIEW: 'SUPPORT_CUSTOMER_VIEW',
  SUPPORT_PAYMENT_VIEW: 'SUPPORT_PAYMENT_VIEW',
  SUPPORT_DELIVERY_VIEW: 'SUPPORT_DELIVERY_VIEW',
  SUPPORT_REFUND_REQUEST: 'SUPPORT_REFUND_REQUEST',
  SUPPORT_REFUND_APPROVE: 'SUPPORT_REFUND_APPROVE',
  SUPPORT_FAQ_MANAGE: 'SUPPORT_FAQ_MANAGE',
  SUPPORT_CANNED_MANAGE: 'SUPPORT_CANNED_MANAGE',
  SUPPORT_REPORT_VIEW: 'SUPPORT_REPORT_VIEW',
  SUPPORT_AI_MANAGE: 'SUPPORT_AI_MANAGE',
};

// Default permissions for each system role
export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: ['*'], // Full access

  SUB_ADMIN: [], // Empty by default - Super Admin assigns

  // ORDER_MANAGER: full order lifecycle, NO financial/delivery/inventory mutation.
  // Prohibited (never granted here): accounting/journal/expense edits, payment
  // record deletion, refund completion, delivery-charge rules, coupon rules,
  // system settings, admin user management.
  ORDER_MANAGER: [
    'ORDER_VIEW',
    'ORDER_UPDATE',
    'ORDER_CANCEL',
    'ORDER_ASSIGN_RIDER',
    'CUSTOMER_VIEW',
    'INVOICE_VIEW',
    'order.search',
    'order.filter',
    'order.confirm',
    'order.process',
    'order.assign',
    'order.unassign',
    'order.status.update',
    'order.priority.update',
    'order.customer.edit',
    'order.address.edit',
    'order.cancel',
    'order.hold',
    'order.reopen',
    'order.note.create',
    'order.note.view',
    'order.communication.send',
    'order.report.view',
    'order.report.export',
    'order.audit.view',
    'order.payment.view',
    'order.financial.view',
    'order.refund.request',
    // Read-only delivery visibility (routing/shipment status — no courier config)
    'delivery.view',
    'delivery.shipment.view',
    'delivery.tracking.view',
    // order.view_sensitive + order.item.edit stay ungranted by default
    // (SUPER_ADMIN can grant per-user via custom permissions).
  ],

  DELIVERY_MANAGER: [
    'ORDER_VIEW',
    'ORDER_UPDATE',
    'ORDER_ASSIGN_RIDER',
    'DELIVERY_AREA_VIEW',
    'DELIVERY_AREA_CREATE',
    'DELIVERY_AREA_UPDATE',
    'REPORT_VIEW',
    'RIDER_VIEW',
    'RIDER_ASSIGN',
    'delivery.view',
    'delivery.zone.view',
    'delivery.zone.create',
    'delivery.zone.update',
    'delivery.zone.delete',
    'delivery.zone.activate',
    'delivery.rider.view',
    'delivery.rider.create',
    'delivery.rider.update',
    'delivery.rider.assign',
    'delivery.shipment.view',
    'delivery.shipment.create',
    'delivery.shipment.cancel',
    'delivery.shipment.retry',
    'delivery.courier.view',
    'delivery.courier.manage',
    'delivery.courier.activate',
    'delivery.courier.configure',
    'delivery.tracking.view',
    'delivery.settlement.view',
    'delivery.report.view',
    'delivery.report.export',
    'delivery.audit.view',
  ],

  DELIVERY_RIDER: [
    'ORDER_VIEW',
    'ORDER_UPDATE', // only status update
    'delivery.view',
    'delivery.shipment.view',
    'delivery.tracking.view',
    'delivery.rider.view',
  ],

  ACCOUNTANT: [
    'ORDER_VIEW',
    'PAYMENT_VIEW',
    'PAYMENT_REPORT',
    'REPORT_VIEW',
    'REPORT_SALES',
    'REPORT_PURCHASE',
    'REPORT_EXPENSE',
    'REPORT_FINANCIAL',
    'REPORT_PROFIT',
    'REPORT_DUE',
    'REPORT_TAX',
    'REPORT_RETURN',
    'PURCHASE_VIEW',
    'EXPENSE_VIEW',
    'SUPPLIER_VIEW',
    'RETURN_VIEW',
    'ACCOUNTING_VIEW',
    'ACCOUNTING_MANAGE',
    'INVOICE_VIEW',
    'INVOICE_DOWNLOAD',
  ],

  // INVENTORY_MANAGER: stock/warehouse/transfer/receiving/inspection.
  // Prohibited (never granted): selling-price edits, accounting ledger,
  // payment transactions, refund completion, delivery charges, order
  // financials, system settings.
  INVENTORY_MANAGER: [
    'inventory.view',
    'inventory.stock.view',
    'inventory.stock.adjust',
    'inventory.reservation.view',
    'inventory.reservation.create',
    'inventory.reservation.release',
    'inventory.movement.view',
    'inventory.warehouse.view',
    'inventory.warehouse.create',
    'inventory.warehouse.update',
    'inventory.transfer.view',
    'inventory.transfer.create',
    'inventory.transfer.receive',
    'inventory.purchase.receive',
    'inventory.return.view',
    'inventory.return.inspect',
    'inventory.return.restock',
    'inventory.batch.view',
    'inventory.batch.create',
    'inventory.batch.update',
    'inventory.expiry.view',
    'inventory.expiry.manage',
    'inventory.damage.view',
    'inventory.damage.create',
    'inventory.loss.create',
    'inventory.valuation.view',
    'inventory.alert.view',
    'inventory.alert.manage',
    'inventory.report.view',
    'inventory.report.export',
    'inventory.audit.view',
    'inventory.settings.view',
    'product.import',
    'product.bulk_edit',
    'PRODUCT_VIEW',
    'ORDER_VIEW',
    'RETURN_VIEW',
    'PURCHASE_VIEW',
    'SUPPLIER_VIEW',
  ],

  CUSTOMER: [], // No admin permissions

  SUPPORT_MANAGER: [
    'SUPPORT_VIEW',
    'SUPPORT_REPLY',
    'SUPPORT_ASSIGN',
    'SUPPORT_CUSTOMER_VIEW',
    'SUPPORT_PAYMENT_VIEW',
    'SUPPORT_DELIVERY_VIEW',
    'SUPPORT_REFUND_REQUEST',
    'SUPPORT_REFUND_APPROVE',
    'SUPPORT_FAQ_MANAGE',
    'SUPPORT_CANNED_MANAGE',
    'SUPPORT_REPORT_VIEW',
    'ORDER_VIEW',
    'CUSTOMER_VIEW',
    'RETURN_VIEW',
  ],

  SUPPORT_AGENT: [
    'SUPPORT_VIEW',
    'SUPPORT_REPLY',
    'SUPPORT_CUSTOMER_VIEW',
    'SUPPORT_PAYMENT_VIEW',
    'SUPPORT_DELIVERY_VIEW',
    'SUPPORT_REFUND_REQUEST',
    'ORDER_VIEW',
    'CUSTOMER_VIEW',
  ],

  DELIVERY_SUPPORT: [
    'SUPPORT_VIEW',
    'SUPPORT_REPLY',
    'SUPPORT_CUSTOMER_VIEW',
    'SUPPORT_DELIVERY_VIEW',
    'ORDER_VIEW',
  ],

  PAYMENT_SUPPORT: [
    'SUPPORT_VIEW',
    'SUPPORT_REPLY',
    'SUPPORT_CUSTOMER_VIEW',
    'SUPPORT_PAYMENT_VIEW',
    'ORDER_VIEW',
    'PAYMENT_VIEW',
  ],

  REFUND_MANAGER: [
    'SUPPORT_VIEW',
    'SUPPORT_REPLY',
    'SUPPORT_CUSTOMER_VIEW',
    'SUPPORT_REFUND_REQUEST',
    'SUPPORT_REFUND_APPROVE',
    'ORDER_VIEW',
    'RETURN_VIEW',
  ],

  AI_MANAGER: ['SUPPORT_VIEW', 'SUPPORT_REPORT_VIEW', 'SUPPORT_AI_MANAGE', 'SUPPORT_FAQ_MANAGE'],
};

// Helper: Check if user has permission
export const hasPermission = (user, permission) => {
  if (!user) return false;

  // Super Admin has everything
  if (user.role === 'SUPER_ADMIN' || (user.permissions && user.permissions.includes('*'))) {
    return true;
  }

  // Check direct permissions
  if (user.permissions && user.permissions.includes(permission)) {
    return true;
  }

  // Check role default permissions
  const rolePerms = ROLE_PERMISSIONS[user.role] || [];
  return rolePerms.includes(permission) || rolePerms.includes('*');
};

// Helper: Get all effective permissions of a user
export const getEffectivePermissions = (user) => {
  if (!user) return [];

  if (user.role === 'SUPER_ADMIN' || (user.permissions && user.permissions.includes('*'))) {
    return Object.values(ALL_PERMISSIONS);
  }

  const rolePerms = ROLE_PERMISSIONS[user.role] || [];
  const customPerms = user.permissions || [];

  // Merge and unique
  return [...new Set([...rolePerms, ...customPerms])];
};

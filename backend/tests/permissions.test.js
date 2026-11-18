import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_PERMISSIONS, ROLE_PERMISSIONS, hasPermission } from '../utils/permissions.js';

// Regression guard: duplicate object keys silently drop permissions
// (this exact bug once hid INVENTORY_MANAGER + DELIVERY_MANAGER rights).
describe('permission registry integrity', () => {
  it('ALL_PERMISSIONS has no duplicate values', () => {
    const vals = Object.values(ALL_PERMISSIONS);
    assert.equal(new Set(vals).size, vals.length);
  });
  it('every role references only defined permissions (or *)', () => {
    const known = new Set([...Object.values(ALL_PERMISSIONS), 'ORDER_VIEW', 'ORDER_UPDATE', 'ORDER_CANCEL', 'ORDER_ASSIGN_RIDER', 'CUSTOMER_VIEW', 'INVOICE_VIEW', 'PRODUCT_VIEW', 'PRODUCT_UPDATE', 'CATEGORY_VIEW', 'REPORT_VIEW', 'RIDER_VIEW', 'RIDER_ASSIGN', 'DELIVERY_AREA_VIEW', 'DELIVERY_AREA_CREATE', 'DELIVERY_AREA_UPDATE', 'PAYMENT_VIEW', 'INVENTORY_VIEW', 'INVENTORY_UPDATE', 'RETURN_VIEW', 'PURCHASE_VIEW', 'SUPPLIER_VIEW', '*']);
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      for (const p of perms) {
        assert.ok(known.has(p), `${role} references unknown permission: ${p}`);
      }
    }
  });
  it('key staff roles are non-empty', () => {
    for (const r of ['ORDER_MANAGER', 'INVENTORY_MANAGER', 'DELIVERY_MANAGER', 'DELIVERY_RIDER', 'SUPPORT_AGENT']) {
      assert.ok((ROLE_PERMISSIONS[r] || []).length > 3, `${r} has too few permissions`);
    }
  });
  it('hasPermission: super admin passes everything, customer nothing staff', () => {
    assert.ok(hasPermission({ role: 'SUPER_ADMIN' }, 'anything.at.all'));
    assert.ok(!hasPermission({ role: 'CUSTOMER' }, 'ORDER_VIEW'));
    assert.ok(hasPermission({ role: 'DELIVERY_RIDER', permissions: [] }, 'delivery.shipment.view'));
    assert.ok(!hasPermission({ role: 'DELIVERY_RIDER', permissions: [] }, 'delivery.courier.configure'));
  });
});

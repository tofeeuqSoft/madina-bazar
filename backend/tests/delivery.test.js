import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStatus,
  decideRoute,
  selectProviders,
  fallbackChain,
  capacityDecision,
  shipmentKey,
  backoffMs,
  scoreRider,
  planZoneCapacity,
} from '../services/delivery/deliveryLogic.js';

// Business-rule scenarios (§37) that are pure logic — no DB needed.
// DB-backed flows (routing, idempotency, audit) are covered by live API tests.

describe('routing decision — coverage drives mode, never area names', () => {
  it('Mirpur-style active own zone → OWN_DELIVERY', () => {
    const r = decideRoute({ coverage: { status: 'ACTIVE', deliveryMode: 'OWN_DELIVERY', zoneId: 'z1' } });
    assert.equal(r.deliveryMode, 'OWN_DELIVERY');
  });
  it('newly activated zone routes automatically (any name)', () => {
    const r = decideRoute({ coverage: { status: 'ACTIVE', deliveryMode: 'OWN_DELIVERY', zoneId: 'uttara-9' } });
    assert.equal(r.deliveryMode, 'OWN_DELIVERY');
  });
  it('inactive zone → EXTERNAL_COURIER', () => {
    const r = decideRoute({ coverage: { status: 'INACTIVE', deliveryMode: 'OWN_DELIVERY' } });
    assert.equal(r.deliveryMode, 'EXTERNAL_COURIER');
  });
  it('coming-soon zone → EXTERNAL_COURIER', () => {
    const r = decideRoute({ coverage: { status: 'COMING_SOON', deliveryMode: 'OWN_DELIVERY' } });
    assert.equal(r.deliveryMode, 'EXTERNAL_COURIER');
  });
  it('no coverage → EXTERNAL_COURIER', () => {
    assert.equal(decideRoute({ coverage: null }).deliveryMode, 'EXTERNAL_COURIER');
  });
  it('mixed cart inside own zone → OWN_DELIVERY (location decides, not cart mix)', () => {
    const r = decideRoute({ coverage: { status: 'ACTIVE', deliveryMode: 'OWN_DELIVERY' } });
    assert.equal(r.deliveryMode, 'OWN_DELIVERY');
  });
});

describe('courier selection engine', () => {
  const providers = [
    { code: 'STEADFAST', status: 'ACTIVE', priority: 1, codSupported: true },
    { code: 'PATHAO', status: 'ACTIVE', priority: 2, codSupported: true },
    { code: 'CARIBEE', status: 'INACTIVE', priority: 3, codSupported: true },
    { code: 'PAPERFLY', status: 'ACTIVE', priority: 4, codSupported: false },
  ];
  it('disabled provider never selected', () => {
    const out = selectProviders({ providers });
    assert.ok(!out.some((p) => p.code === 'CARIBEE'));
    assert.equal(out[0].code, 'STEADFAST');
  });
  it('COD orders skip non-COD providers', () => {
    const out = selectProviders({ providers, codNeeded: true });
    assert.ok(!out.some((p) => p.code === 'PAPERFLY'));
  });
  it('fallback skips the failed provider and non-fallback ones', () => {
    const chain = fallbackChain({ failedCode: 'STEADFAST', providers });
    assert.equal(chain[0].code, 'PATHAO');
    assert.ok(!chain.some((p) => p.code === 'STEADFAST'));
  });
});

describe('rider capacity policy', () => {
  it('remaining capacity → ASSIGN', () => {
    assert.equal(capacityDecision({ zoneOrdersToday: 10, riderCapacity: 30 }).action, 'ASSIGN');
  });
  it('full capacity → configured policy (default ADMIN_REVIEW)', () => {
    assert.equal(capacityDecision({ zoneOrdersToday: 30, riderCapacity: 30 }).action, 'ADMIN_REVIEW');
    assert.equal(capacityDecision({ zoneOrdersToday: 40, riderCapacity: 30, policy: 'USE_EXTERNAL_COURIER' }).action, 'USE_EXTERNAL_COURIER');
  });
});

describe('unified status + idempotency', () => {
  it('provider statuses normalize to internal lifecycle', () => {
    assert.equal(normalizeStatus('Delivered'), 'DELIVERED');
    assert.equal(normalizeStatus('out for delivery'), 'OUT_FOR_DELIVERY');
    assert.equal(normalizeStatus('in_transit'), 'IN_TRANSIT');
    assert.equal(normalizeStatus('weird-unknown-xyz'), 'IN_TRANSIT');
  });
  it('same order+attempt always yields same shipment key', () => {
    assert.equal(shipmentKey('o1', 1), shipmentKey('o1', 1));
    assert.notEqual(shipmentKey('o1', 1), shipmentKey('o1', 2));
  });
  it('exponential backoff capped', () => {
    assert.equal(backoffMs(1, 1000, 30000), 1000);
    assert.equal(backoffMs(10, 1000, 30000), 30000);
  });
});

describe('rider scoring + capacity planning', () => {
  it('better rider scores higher (load + distance matter)', () => {
    const a = scoreRider({ zoneMatch: 1, distanceKm: 1, remainingCapacity: 25, maxCapacity: 30, activeOrders: 0, maxActive: 5, successRate: 0.98, shiftActive: true });
    const b = scoreRider({ zoneMatch: 1, distanceKm: 12, remainingCapacity: 2, maxCapacity: 30, activeOrders: 5, maxActive: 5, successRate: 0.7, shiftActive: true });
    assert.ok(a > b);
  });
  it('off-shift rider never assignable', () => {
    assert.equal(scoreRider({ zoneMatch: 1, shiftActive: false }), -1);
  });
  it('new zone shortage recommends rider count', () => {
    const p = planZoneCapacity({ expectedDailyOrders: 150, riders: [{ maxDailyOrders: 30 }, { maxDailyOrders: 30 }] });
    assert.equal(p.requiredRiders, 5);
    assert.equal(p.shortage, 3);
    assert.match(p.recommendation, /3 additional/);
  });
  it('sufficient capacity → no shortage', () => {
    const p = planZoneCapacity({ expectedDailyOrders: 100, riders: Array.from({ length: 5 }, () => ({ maxDailyOrders: 30 })) });
    assert.equal(p.shortage, 0);
  });
});

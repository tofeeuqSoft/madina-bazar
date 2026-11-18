// Pure delivery-network logic — NO database imports, so node:test can
// exercise routing/selection/fallback/capacity rules without MongoDB.

// --- Unified status normalization (provider raw → internal) ---
const STATUS_ALIASES = {
  // Own-rider legacy → unified
  Pending: 'CREATED',
  Confirmed: 'PENDING_ASSIGNMENT',
  Processing: 'PICKED_UP',
  'Ready for Delivery': 'PENDING_PICKUP',
  'Out for Delivery': 'OUT_FOR_DELIVERY',
  Delivered: 'DELIVERED',
  Cancelled: 'CANCELLED',
  // Generic courier vocabularies → unified
  PENDING: 'PENDING_PICKUP',
  PICKED_UP: 'PICKED_UP',
  PICKUP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  TRANSIT: 'IN_TRANSIT',
  AT_DESTINATION: 'AT_DESTINATION',
  HUB: 'AT_DESTINATION',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  CANCELED: 'CANCELLED',
  RETURN_REQUESTED: 'RETURN_REQUESTED',
  RETURNED: 'RETURNED',
};

export const normalizeStatus = (raw) => {
  if (!raw) return 'CREATED';
  const key = String(raw).trim().toUpperCase().replace(/[\s-]+/g, '_');
  return STATUS_ALIASES[key] || STATUS_ALIASES[String(raw).trim()] || 'IN_TRANSIT';
};

// --- Core routing decision (location coverage is the ONLY input) ---
export const decideRoute = ({ coverage }) => {
  if (coverage && coverage.status === 'ACTIVE' && coverage.deliveryMode === 'OWN_DELIVERY') {
    return { deliveryMode: 'OWN_DELIVERY', zoneId: coverage.zoneId || null };
  }
  return { deliveryMode: 'EXTERNAL_COURIER', zoneId: coverage?.zoneId || null };
};

// --- Courier selection (ADMIN_PRIORITY default; cost/success/speed/manual) ---
export const selectProviders = ({ providers = [], mode = 'ADMIN_PRIORITY', codNeeded = false, district = '' }) => {
  let pool = providers.filter((p) => p.status === 'ACTIVE');
  if (codNeeded) pool = pool.filter((p) => p.codSupported !== false);
  if (district) {
    pool = pool.filter((p) => !p.coverageDistricts?.length || p.coverageDistricts.some((d) => String(d).toLowerCase() === String(district).toLowerCase()));
  }
  const by = {
    ADMIN_PRIORITY: (a, b) => (a.priority || 99) - (b.priority || 99),
    COST: (a, b) => (a.avgCost || 0) - (b.avgCost || 0),
    SUCCESS_RATE: (a, b) => (b.successRate ?? 1) - (a.successRate ?? 1),
    SPEED: (a, b) => (a.avgDeliveryHours || 999) - (b.avgDeliveryHours || 999),
    MANUAL: () => 0,
  };
  return [...pool].sort(by[mode] || by.ADMIN_PRIORITY);
};

// --- Fallback chain: primary → next fallbackAllowed provider ---
export const fallbackChain = ({ failedCode, providers = [] }) => {
  const ordered = selectProviders({ providers });
  const idx = ordered.findIndex((p) => p.code === failedCode);
  return ordered.slice(idx + 1).filter((p) => p.fallbackAllowed !== false);
};

// --- Rider capacity policy ---
export const capacityDecision = ({ zoneOrdersToday = 0, riderCapacity = 0, policy = 'ADMIN_REVIEW' }) => {
  if (riderCapacity > zoneOrdersToday) return { action: 'ASSIGN', remaining: riderCapacity - zoneOrdersToday };
  return { action: policy, remaining: 0 }; // WAIT | REASSIGN | USE_EXTERNAL_COURIER | ADMIN_REVIEW
};

// --- Rider scoring (configurable weights, all 0..1 normalized inputs) ---
export const DEFAULT_SCORE_WEIGHTS = { zone: 0.3, distance: 0.25, capacity: 0.2, workload: 0.15, performance: 0.1 };

export const scoreRider = ({ zoneMatch = 0, distanceKm = 0, remainingCapacity = 0, maxCapacity = 1, activeOrders = 0, maxActive = 5, successRate = 1, shiftActive = true, weights = DEFAULT_SCORE_WEIGHTS } = {}) => {
  if (!shiftActive) return -1;
  const distScore = Math.max(0, 1 - distanceKm / 20);
  const capScore = Math.max(0, Math.min(1, remainingCapacity / Math.max(1, maxCapacity)));
  const loadScore = Math.max(0, 1 - activeOrders / Math.max(1, maxActive));
  return (
    (weights.zone || 0) * zoneMatch +
    (weights.distance || 0) * distScore +
    (weights.capacity || 0) * capScore +
    (weights.workload || 0) * loadScore +
    (weights.performance || 0) * Math.max(0, Math.min(1, successRate))
  );
};

// Zone capacity planning → shortage recommendation
export const planZoneCapacity = ({ expectedDailyOrders = 0, riders = [] } = {}) => {
  const totalCapacity = riders.reduce((s, r) => s + (r.maxDailyOrders || 0), 0);
  const perRider = 30;
  const required = expectedDailyOrders > 0 ? Math.ceil(expectedDailyOrders / perRider) : riders.length;
  const shortage = Math.max(0, required - riders.length);
  return {
    expectedDailyOrders,
    totalCapacity,
    utilization: totalCapacity ? Number((Math.min(1, expectedDailyOrders / totalCapacity) * 100).toFixed(1)) : 0,
    requiredRiders: required,
    currentRiders: riders.length,
    shortage,
    recommendation: shortage > 0 ? `Zone requires approximately ${shortage} additional rider(s).` : 'Capacity sufficient.',
  };
};

// --- Idempotency keys (retries/webhooks can never duplicate) ---
export const shipmentKey = (orderId, attempt = 1) => `SHIP:ORDER:${orderId}:${attempt}`;
export const webhookKey = (provider, eventId) => `WH:${provider}:${eventId}`;

export const backoffMs = (attempt, base = 1000, cap = 30000) =>
  Math.min(cap, base * 2 ** Math.max(0, attempt - 1));

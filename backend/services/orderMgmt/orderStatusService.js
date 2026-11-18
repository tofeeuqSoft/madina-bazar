// Canonical ORDER_MANAGER lifecycle. Legacy Title-Case statuses are mapped
// to canonical UPPER_SNAKE so old + new data flow through one state machine.
// DB keeps the stored value untouched; transitions validate on canonical form.

export const CANONICAL = {
  Pending: 'PLACED',
  PLACED: 'PLACED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  Confirmed: 'CONFIRMED',
  CONFIRMED: 'CONFIRMED',
  Processing: 'PROCESSING',
  PROCESSING: 'PROCESSING',
  'Ready for Delivery': 'READY_TO_SHIP',
  READY_TO_SHIP: 'READY_TO_SHIP',
  Shipped: 'SHIPPED',
  SHIPPED: 'SHIPPED',
  'Out for Delivery': 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  Delivered: 'DELIVERED',
  DELIVERED: 'DELIVERED',
  Cancelled: 'CANCELLED',
  CANCELLED: 'CANCELLED',
  ON_HOLD: 'ON_HOLD',
  FAILED: 'FAILED',
};

export const canonicalOf = (status) => CANONICAL[status] || status;

// Stored value to write when moving to a canonical state (prefer canonical
// UPPER_SNAKE for new writes; legacy reads keep working).
const STORE = {
  PLACED: 'PLACED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  READY_TO_SHIP: 'READY_TO_SHIP',
  SHIPPED: 'SHIPPED',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  ON_HOLD: 'ON_HOLD',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
};

const TRANSITIONS = {
  PLACED: ['PENDING_VERIFICATION', 'CONFIRMED', 'ON_HOLD', 'CANCELLED'],
  PENDING_VERIFICATION: ['CONFIRMED', 'ON_HOLD', 'CANCELLED', 'FAILED'],
  CONFIRMED: ['PROCESSING', 'ON_HOLD', 'CANCELLED'],
  PROCESSING: ['READY_TO_SHIP', 'ON_HOLD', 'CANCELLED'],
  READY_TO_SHIP: ['SHIPPED', 'ON_HOLD', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  ON_HOLD: ['PENDING_VERIFICATION', 'CONFIRMED', 'PROCESSING', 'CANCELLED'],
  CANCELLED: [],
  FAILED: ['PENDING_VERIFICATION'],
};

export const allowedNext = (status) => TRANSITIONS[canonicalOf(status)] || [];

export const assertTransition = (from, to) => {
  const f = canonicalOf(from);
  const t = canonicalOf(to);
  if (f === t) return STORE[t] || to;
  if (!(TRANSITIONS[f] || []).includes(t)) {
    const err = new Error(`Invalid status transition ${from} -> ${to}`);
    err.statusCode = 400;
    err.code = 'ORDER_INVALID_TRANSITION';
    throw err;
  }
  return STORE[t] || to;
};

export const CANCELLABLE = ['PLACED', 'PENDING_VERIFICATION', 'CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'ON_HOLD'];

export const canCancel = (status) => CANCELLABLE.includes(canonicalOf(status));

export const CANCEL_REASONS = ['CUSTOMER_REQUEST', 'OUT_OF_STOCK', 'DUPLICATE_ORDER', 'PAYMENT_FAILED', 'ADDRESS_ISSUE', 'ADMIN_REASON', 'OTHER'];
export const HOLD_REASONS = ['PAYMENT_VERIFICATION', 'CUSTOMER_CONFIRMATION', 'STOCK_ISSUE', 'ADDRESS_ISSUE', 'FRAUD_REVIEW', 'DELIVERY_ISSUE', 'OTHER'];

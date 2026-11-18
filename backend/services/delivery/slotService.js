import DeliverySlot from '../../models/DeliverySlot.js';
import Order from '../../models/Order.js';

// Slot capacity guard: count live orders on (slot, date); full → reject.
// Excludes dead orders. Same-day past slots are rejected by date check.
const DEAD = ['Cancelled', 'CANCELLED', 'FAILED'];

const dayRange = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const next = new Date(d);
  next.setDate(d.getDate() + 1);
  return { d, next };
};

export const listSlots = async ({ zone = null, applicableTo = null, date = null } = {}) => {
  const q = { isActive: true };
  if (zone) q.$or = [{ zone }, { zone: null }];
  if (applicableTo) q.applicableTo = { $in: [applicableTo, 'ALL'] };
  const slots = await DeliverySlot.find(q).sort({ sortOrder: 1, startHour: 1 }).lean();
  if (!date) return slots.map((s) => ({ ...s, booked: null, remaining: null }));
  const range = dayRange(date);
  if (!range) return slots.map((s) => ({ ...s, booked: null, remaining: null }));
  const out = [];
  for (const s of slots) {
    const booked = await Order.countDocuments({
      'deliverySlot.slot': s._id,
      'deliverySlot.date': { $gte: range.d, $lt: range.next },
      orderStatus: { $nin: DEAD },
    });
    out.push({ ...s, booked, remaining: Math.max(0, s.capacity - booked) });
  }
  return out;
};

export const assertSlotAvailable = async ({ slotId, date }) => {
  if (!slotId) return null; // slots optional — no slot, no promise
  const slot = await DeliverySlot.findById(slotId);
  if (!slot || !slot.isActive) {
    throw Object.assign(new Error('Delivery slot is not available'), { statusCode: 400, code: 'SLOT_INVALID' });
  }
  const range = dayRange(date);
  if (!range || range.d < new Date(new Date().toDateString())) {
    throw Object.assign(new Error('Delivery date must be today or later'), { statusCode: 400, code: 'SLOT_DATE_INVALID' });
  }
  if (slot.cutoffHour != null && range.d.getTime() === new Date(new Date().toDateString()).getTime() && new Date().getHours() >= slot.cutoffHour) {
    throw Object.assign(new Error(`Today's "${slot.label || slot.name}" window closed (cutoff ${slot.cutoffHour}:00) — pick another day`), { statusCode: 400, code: 'SLOT_CUTOFF_PASSED' });
  }
  const booked = await Order.countDocuments({
    'deliverySlot.slot': slot._id,
    'deliverySlot.date': { $gte: range.d, $lt: range.next },
    orderStatus: { $nin: DEAD },
  });
  if (booked >= slot.capacity) {
    throw Object.assign(new Error(`Slot "${slot.label || slot.name}" is full for ${date}`), { statusCode: 400, code: 'SLOT_FULL' });
  }
  return slot;
};

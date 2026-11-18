import mongoose from 'mongoose';

// Delivery time windows. Scope: a slot optionally belongs to a grocery zone;
// zoneless slots serve nationwide. Capacity is enforced per (slot, date) at
// checkout — full slots are rejected, never overbooked.
const deliverySlotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Morning"
    label: { type: String, default: '' }, // e.g. "10AM – 12PM"
    startHour: { type: Number, required: true, min: 0, max: 23 },
    endHour: { type: Number, required: true, min: 1, max: 24 },
    capacity: { type: Number, required: true, min: 1, default: 50 },
    // Same-day cutoff hour (e.g. 14 = no today-booking after 2PM); null = no cutoff
    cutoffHour: { type: Number, min: 0, max: 23, default: null },
    applicableTo: { type: String, enum: ['GROCERY', 'NATIONWIDE', 'ALL'], default: 'ALL' },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'GroceryZone', default: null },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

deliverySlotSchema.index({ isActive: 1, sortOrder: 1 });
deliverySlotSchema.index({ zone: 1, isActive: 1 });

const DeliverySlot = mongoose.model('DeliverySlot', deliverySlotSchema);
export default DeliverySlot;

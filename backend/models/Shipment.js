import mongoose from 'mongoose';

// Shipment is a SEPARATE entity from Order (one order → one or more shipments).
// Own-rider and external-courier share this single lifecycle + status system.
export const SHIPMENT_STATUS = [
  'CREATED',
  'PENDING_ASSIGNMENT',
  'ASSIGNED',
  'ACCEPTED',
  'PENDING_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'AT_DESTINATION',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURNED',
];

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: SHIPMENT_STATUS, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const shipmentSchema = new mongoose.Schema(
  {
    shipmentNo: { type: String, unique: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },

    deliveryMode: { type: String, enum: ['OWN_DELIVERY', 'EXTERNAL_COURIER'], required: true },
    provider: {
      type: String,
      enum: ['OWN_RIDER', 'STEADFAST', 'PATHAO', 'CARIBEE', 'PAPERFLY'],
      required: true,
    },

    // Coverage snapshot (zone config may change later — history preserved)
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'GroceryZone', default: null },
    zoneName: { type: String, default: '' },
    areaName: { type: String, default: '' },
    barikoiLocationId: { type: String, default: '' },

    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', default: null },

    courierShipmentId: { type: String, default: '' },
    trackingNumber: { type: String, default: '' },

    status: { type: String, enum: SHIPMENT_STATUS, default: 'CREATED' },
    statusHistory: [statusHistorySchema],

    codAmount: { type: Number, default: 0, min: 0 },
    collectedAmount: { type: Number, default: 0, min: 0 },
    codSettled: { type: Boolean, default: false },

    // Customer charge vs actual cost — stored separately, snapshotted at creation
    customerDeliveryCharge: { type: Number, default: 0, min: 0 },
    actualDeliveryCost: { type: Number, default: 0, min: 0 },
    deliveryMargin: { type: Number, default: 0 },

    // Proof-of-delivery OTP — never selected, never sent to frontend
    deliveryOtp: { type: String, default: '', select: false },
    deliveryOtpExpire: { type: Date, default: null, select: false },

    // Idempotency: one shipment per order per attempt — retries can never duplicate
    idempotencyKey: { type: String, unique: true, sparse: true },
    attempt: { type: Number, default: 1 },
    lastError: { type: String, default: '' },
    // RTO tracking: when it failed + when return-to-origin started
    failedAt: { type: Date, default: null },
    rtoAt: { type: Date, default: null },
    // Dispatch confirm gate: external bookings wait for Order Manager
    awaitingConfirm: { type: Boolean, default: false },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    confirmedAt: { type: Date, default: null },
    confirmRemindedAt: { type: Date, default: null },
    escalatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

shipmentSchema.pre('validate', async function (next) {
  if (this.isNew && !this.shipmentNo) {
    const count = await mongoose.model('Shipment').countDocuments();
    this.shipmentNo = `SHP${Date.now().toString().slice(-8)}${(count + 1).toString().padStart(4, '0')}`;
  }
  if (this.isNew && !this.idempotencyKey) {
    this.idempotencyKey = `SHIP:ORDER:${this.order}:${this.attempt || 1}`;
  }
  next();
});

shipmentSchema.index({ order: 1, createdAt: -1 });
shipmentSchema.index({ status: 1, createdAt: -1 });
shipmentSchema.index({ provider: 1, status: 1 });
shipmentSchema.index({ rider: 1, status: 1 });
shipmentSchema.index({ trackingNumber: 1 });

const Shipment = mongoose.model('Shipment', shipmentSchema);
export default Shipment;

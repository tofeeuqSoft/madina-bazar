import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  },
  combo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Combo',
  },
  name: String,
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
  },
  unit: String,
  // Historical cost snapshot (product costPrice at order time — never recalculated)
  cost: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Selected variant snapshot (optional)
  size: { type: String, default: '' },
  color: { type: String, default: '' },
});

const shippingAddressSchema = new mongoose.Schema({
  fullName: String,
  phone: String,
  address: String,
  area: String,
  city: String,
  deliveryArea: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryArea',
  },
  latitude: Number,
  longitude: Number,
  placeId: String,
  // Barikoi Location ID — preserved alongside placeId/uCode for support + riders
  barikoiLocationId: {
    type: String,
    default: '',
  },
  uCode: {
    type: String,
    default: '',
  },
  // Grocery zone snapshot (which zone served this order, if any)
  zone: {
    type: String,
    default: '',
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderItems: [orderItemSchema],
    // Substitution proposals (grocery): unavailable line → proposed alternative.
    // Customer approves/rejects; approval swaps stock + totals atomically-ish.
    substitutions: [
      {
        line: { type: mongoose.Schema.Types.ObjectId },
        substituteProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        substituteName: { type: String, default: '' },
        quantity: { type: Number, required: true, min: 1 },
        priceDiff: { type: Number, default: 0 },
        status: { type: String, enum: ['PROPOSED', 'APPROVED', 'REJECTED'], default: 'PROPOSED' },
        note: { type: String, default: '' },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        decidedAt: { type: Date, default: null },
      },
    ],
    shippingAddress: shippingAddressSchema,
    deliveryArea: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryArea',
    },
    // Delivery slot snapshot (slot config may change later — history preserved)
    deliverySlot: {
      slot: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliverySlot', default: null },
      date: { type: Date, default: null },
      label: { type: String, default: '' },
    },
    paymentMethod: {
      type: String,
      enum: ['COD', 'BKASH', 'NAGAD', 'SSLCOMMERZ'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
      default: 'Pending',
    },
    paymentMeta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    orderStatus: {
      type: String,
      // Legacy Title-Case values preserved for existing data; UPPER_SNAKE
      // values are the canonical ORDER_MANAGER lifecycle. Both accepted.
      enum: [
        'Pending',
        'Confirmed',
        'Processing',
        'Ready for Delivery',
        'Out for Delivery',
        'Delivered',
        'Cancelled',
        'PLACED',
        'PENDING_VERIFICATION',
        'CONFIRMED',
        'PROCESSING',
        'READY_TO_SHIP',
        'SHIPPED',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'ON_HOLD',
        'CANCELLED',
        'FAILED',
      ],
      default: 'Pending',
    },
    deliveryStatus: {
      type: String,
      enum: ['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Failed', 'Returned'],
      default: 'Pending',
    },
    // Set by the Delivery Orchestrator at CONFIRMED (display mirror —
    // routing history lives in Shipment, never recalculated here)
    deliveryMode: {
      type: String,
      enum: ['OWN_DELIVERY', 'EXTERNAL_COURIER', ''],
      default: '',
    },
    // Delivery type resolved by Delivery Service (never by ORDER_MANAGER)
    deliveryType: {
      type: String,
      enum: ['GROCERY', 'NATIONWIDE', 'MIXED', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    trackingId: { type: String, default: '' },
    courier: { type: String, default: '' },
    expectedDelivery: { type: Date, default: null },
    // Order-manager assignment (staff agent / team). Rider stays separate.
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedTeam: { type: String, default: '' },
    assignedAt: { type: Date, default: null },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
    },
    // Rider assignment
    assignedRider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // ---- Immutable financial snapshot (frozen at creation) ----
    pricingSnapshot: {
      subtotal: { type: Number, default: null },
      productDiscount: { type: Number, default: null },
      couponDiscount: { type: Number, default: null },
      deliveryCharge: { type: Number, default: null },
      tax: { type: Number, default: null },
      refundAmount: { type: Number, default: null },
      grandTotal: { type: Number, default: null },
      snapshottedAt: { type: Date, default: null },
    },
    cancellation: {
      reason: {
        type: String,
        enum: ['CUSTOMER_REQUEST', 'OUT_OF_STOCK', 'DUPLICATE_ORDER', 'PAYMENT_FAILED', 'ADDRESS_ISSUE', 'ADMIN_REASON', 'OTHER', ''],
        default: '',
      },
      note: { type: String, default: '' },
      cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      cancelledAt: { type: Date, default: null },
    },
    hold: {
      isHeld: { type: Boolean, default: false },
      reason: {
        type: String,
        enum: ['PAYMENT_VERIFICATION', 'CUSTOMER_CONFIRMATION', 'STOCK_ISSUE', 'ADDRESS_ISSUE', 'FRAUD_REVIEW', 'DELIVERY_ISSUE', 'OTHER', ''],
        default: '',
      },
      note: { type: String, default: '' },
      heldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      heldAt: { type: Date, default: null },
      // Auto-release: status to resume + deadline (holds never stick forever)
      prevStatus: { type: String, default: '' },
      expiresAt: { type: Date, default: null },
    },
    // Future-ready risk flags (rules live in a separate fraud service)
    riskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: 'LOW',
    },
    riskFlags: [{ type: String }],
    subtotal: {
      type: Number,
      required: true,
    },
    deliveryCharge: {
      type: Number,
      default: 0,
    },
    // Centralized delivery breakdown snapshot (see deliveryService)
    deliveryInfo: {
      groceryCharge: { type: Number, default: 0 },
      nationwideCharge: { type: Number, default: 0 },
      freeDelivery: { type: Boolean, default: false },
      matchMethod: { type: String, default: '' },
    },
    discount: {
      type: Number,
      default: 0,
    },
    couponCode: String,
    totalAmount: {
      type: Number,
      required: true,
    },
    // Accounting snapshots (immutable history — never recalculated)
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // VAT regime snapshot (BD NBR compliance — invoice uses these, not live settings)
    taxMode: { type: String, enum: ['DISABLED', 'EXCLUSIVE', 'INCLUSIVE', ''], default: '' },
    taxRateSnap: { type: Number, default: null },
    taxNameSnap: { type: String, default: '' },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: String,
    // Status history
    statusHistory: [
      {
        status: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Immutable financial snapshot — frozen on first save, never recalculated.
// Later product/delivery-charge changes cannot mutate historical orders.
orderSchema.pre('save', function (next) {
  if (this.isNew && !this.pricingSnapshot?.snapshottedAt) {
    this.pricingSnapshot = {
      subtotal: this.subtotal,
      productDiscount: 0,
      couponDiscount: this.discount || 0,
      deliveryCharge: this.deliveryCharge,
      tax: this.taxAmount || 0,
      refundAmount: 0,
      grandTotal: this.totalAmount,
      snapshottedAt: new Date(),
    };
  }
  next();
});

// Generate order number
orderSchema.pre('validate', async function (next) {
  if (this.isNew && !this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `MB${Date.now().toString().slice(-8)}${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ deliveryStatus: 1 });
orderSchema.index({ deliveryType: 1 });
orderSchema.index({ priority: 1 });
orderSchema.index({ assignedTo: 1 });
orderSchema.index({ trackingId: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'paymentMeta.paymentID': 1 });
orderSchema.index({ 'paymentMeta.tranId': 1 });

const Order = mongoose.model('Order', orderSchema);
export default Order;

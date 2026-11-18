import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    websiteName: {
      type: String,
      default: 'Madina Bazar',
    },
    logo: {
      type: String,
      default: '',
    },
    favicon: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: '',
    },
    facebook: String,
    whatsapp: String,
    // Payment settings
    enableCOD: {
      type: Boolean,
      default: true,
    },
    enableBkash: {
      type: Boolean,
      default: false,
    },
    enableNagad: {
      type: Boolean,
      default: false,
    },
    enableSSLCommerz: {
      type: Boolean,
      default: false,
    },
    // Homepage tiles (admin-changeable)
    newTileImage: {
      type: String,
      default: '',
    },
    trendingTileImage: {
      type: String,
      default: '',
    },
    // Hero carousel slides (5/6 width) — admin uploads images
    heroSlides: {
      type: [
        {
          image: { type: String, required: true },
          link: { type: String, default: '' }, // e.g. /shop?category=ID
          title: { type: String, default: '' },
          _id: false,
        },
      ],
      default: [],
    },
    // App download panel (1/6 width)
    playStoreUrl: {
      type: String,
      default: '',
    },
    appStoreUrl: {
      type: String,
      default: '',
    },
    appQrImage: {
      type: String,
      default: '',
    },
    // Delivery
    defaultDeliveryCharge: {
      type: Number,
      default: 60,
    },
    // Barikoi
    barikoiApiKey: {
      type: String,
      default: '',
    },
    // Inventory (managed via Inventory Settings page)
    inventoryValuationMethod: {
      type: String,
      enum: ['FIFO', 'WEIGHTED_AVERAGE', 'STANDARD_COST'],
      default: 'WEIGHTED_AVERAGE',
    },
    inventoryFulfillmentMethod: {
      type: String,
      enum: ['FIFO', 'FEFO'],
      default: 'FEFO',
    },
    expirySoonDays: { type: Number, default: 30, min: 1 },
    largeAdjustmentThreshold: { type: Number, default: 50, min: 1 },
    adjustmentApprovalThreshold: { type: Number, default: 100, min: 1 },
    movementArchiveAfterDays: { type: Number, default: 365, min: 90 },
    auditArchiveAfterDays: { type: Number, default: 730, min: 365 },
    // Delivery network policy (Admin Delivery Settings page)
    capacityFullPolicy: {
      type: String,
      enum: ['WAIT', 'REASSIGN', 'USE_EXTERNAL_COURIER', 'ADMIN_REVIEW'],
      default: 'ADMIN_REVIEW',
    },
    courierSelectionMode: {
      type: String,
      enum: ['ADMIN_PRIORITY', 'COST', 'SUCCESS_RATE', 'SPEED', 'MANUAL'],
      default: 'ADMIN_PRIORITY',
    },
    ownDeliveryEnabled: { type: Boolean, default: true },
    courierDispatchConfirm: { type: Boolean, default: false },
    courierAutoConfirmMin: { type: Number, default: 120, min: 0 },
    forecastSmsHour: { type: Number, default: 9, min: 0, max: 23 },
    // Rider scoring weights (zone/distance/capacity/workload/performance)
    riderScoreWeights: {
      type: Object,
      default: { zone: 0.3, distance: 0.25, capacity: 0.2, workload: 0.15, performance: 0.1 },
    },
    // Rider compensation + proof-of-delivery policy
    riderPayModel: {
      type: String,
      enum: ['FIXED_SALARY', 'PER_DELIVERY', 'ZONE_BASED', 'MIXED'],
      default: 'PER_DELIVERY',
    },
    riderPerDeliveryRate: { type: Number, default: 20, min: 0 },
    riderBaseSalary: { type: Number, default: 0, min: 0 },
    otpRequired: { type: Boolean, default: true },
    gpsRequired: { type: Boolean, default: false },
    gpsRadiusM: { type: Number, default: 2000, min: 100 },
  },
  { timestamps: true }
);

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;

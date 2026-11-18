import mongoose from 'mongoose';

// Build a circle-approx Polygon (GeoJSON, [lng, lat]) from center + radius
export function circlePolygon(lat, lng, radiusKm, points = 32) {
  const coords = [];
  const R = 6371; // earth radius km
  const latR = (lat * Math.PI) / 180;
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * 2 * Math.PI;
    const dLat = (radiusKm / R) * Math.cos(theta);
    const dLng = (radiusKm / (R * Math.cos(latR))) * Math.sin(theta);
    coords.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
  }
  return { type: 'Polygon', coordinates: [coords] };
}

const areaSchema = new mongoose.Schema(
  {
    // Barikoi unique IDs — matching runs on these, never on names.
    // (Spelling/name changes can't break delivery eligibility.)
    placeId: { type: String, required: true, trim: true },
    uCode: { type: String, default: '', trim: true },
    name: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    // Per-area charge (spec table: Mirpur 60, Uttara 70...). Falls back to zone default.
    charge: { type: Number, min: 0 },
    lat: { type: Number },
    lng: { type: Number },
    _id: false,
  },
  { _id: false }
);

const groceryZoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Zone name is required'],
      trim: true,
    },
    city: {
      type: String,
      default: 'Dhaka',
    },
    // Admin grouping, e.g. "Dhaka Phase 1" → District Dhaka
    district: {
      type: String,
      default: '',
      trim: true,
    },
    deliveryCharge: {
      type: Number,
      default: 60,
      min: 0,
    },
    minimumOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    estimatedDeliveryTime: {
      type: String,
      default: '2-4 Hours',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Lifecycle: ACTIVE (delivers) / INACTIVE (hidden) / COMING_SOON (visible, not deliverable)
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'COMING_SOON'],
      default: 'ACTIVE',
    },
    // --- Own-delivery network membership (zone expansion = network expansion) ---
    // ACTIVE own-delivery zones automatically route matching orders to own riders.
    // No area names are hard-coded anywhere — matching runs on Barikoi IDs.
    deliveryMode: {
      type: String,
      enum: ['OWN_DELIVERY', 'EXTERNAL_COURIER'],
      default: 'OWN_DELIVERY',
    },
    // Max own-rider orders per day served from this zone (capacity policy)
    riderCapacity: {
      type: Number,
      default: 100,
      min: 0,
    },
    assignedRiders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Actual own-rider cost per delivery (vs customer-facing deliveryCharge)
    actualDeliveryCost: {
      type: Number,
      default: 40,
      min: 0,
    },
    // --- Layer A: Barikoi area list (primary, exact ID match) ---
    areas: {
      type: [areaSchema],
      default: [],
    },
    // --- Layer B: circle fallback (optional, geo match) ---
    // Kept for saved addresses without placeId + GPS drift tolerance.
    centerLat: {
      type: Number,
    },
    centerLng: {
      type: Number,
    },
    radiusKm: {
      type: Number,
      default: 4,
      min: 0.5,
      max: 50,
    },
    // GeoJSON boundary for $geoIntersects queries (only when circle set)
    boundary: {
      type: {
        type: String,
        enum: ['Polygon'],
      },
      coordinates: {
        type: [[[Number]]],
      },
    },
  },
  { timestamps: true }
);

groceryZoneSchema.pre('validate', function (next) {
  // status is source of truth; isActive mirrors it for existing queries
  if (this.status) this.isActive = this.status === 'ACTIVE';
  if (Array.isArray(this.areas)) {
    const seen = new Set();
    this.areas = this.areas.filter((a) => {
      if (!a?.placeId || seen.has(a.placeId)) return false;
      seen.add(a.placeId);
      return true;
    });
  }
  // Boundary rebuilt whenever a circle is defined
  if (this.centerLat != null && this.centerLng != null) {
    this.boundary = circlePolygon(this.centerLat, this.centerLng, this.radiusKm || 4);
  }
  next();
});

groceryZoneSchema.index({ boundary: '2dsphere' });
groceryZoneSchema.index({ isActive: 1 });
groceryZoneSchema.index({ 'areas.placeId': 1 });
groceryZoneSchema.index({ 'areas.uCode': 1 });

const GroceryZone = mongoose.model('GroceryZone', groceryZoneSchema);
export default GroceryZone;

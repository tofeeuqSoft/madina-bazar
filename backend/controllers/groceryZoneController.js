import GroceryZone from '../models/GroceryZone.js';
import DeliveryCheckLog from '../models/DeliveryCheckLog.js';
import { logAudit } from '../utils/auditLog.js';

// Find active grocery zone containing a point (geo fallback — no Barikoi call)
export const findZoneForPoint = async (lat, lng) => {
  if (lat == null || lng == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
    return null;
  }
  return GroceryZone.findOne({
    isActive: true,
    'boundary.coordinates': { $exists: true },
    boundary: {
      $geoIntersects: { $geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] } },
    },
  }).lean();
};

// Find active zone by Barikoi location ID (primary — immune to renames)
export const findZoneForPlace = async (placeId, uCode) => {
  const ids = [placeId, uCode].filter(Boolean);
  if (!ids.length) return null;
  return GroceryZone.findOne({
    isActive: true,
    $or: [{ 'areas.placeId': { $in: ids } }, { 'areas.uCode': { $in: ids } }],
  }).lean();
};

/**
 * Hybrid resolver (my recommended design):
 *  1. Barikoi ID exact match — O(1), rename-proof, no math.
 *  2. Geo-polygon fallback — covers saved pins without placeId + GPS drift.
 * Returns { zone, method: 'barikoi-id' | 'geo' } or null.
 */
export const resolveGroceryZone = async ({ placeId, uCode, lat, lng }) => {
  const byId = await findZoneForPlace(placeId, uCode);
  if (byId) return { zone: byId, method: 'barikoi-id' };
  const la = Number(lat);
  const lo = Number(lng);
  if (Number.isFinite(la) && Number.isFinite(lo)) {
    const byGeo = await findZoneForPoint(la, lo);
    if (byGeo) return { zone: byGeo, method: 'geo' };
  }
  return null;
};

// Best-effort check logging (analytics) — never blocks the response
const logCheck = (req, available, zone, method = '') => {
  try {
    const { lat, lng, latitude, longitude, placeId, uCode, address } = req.body || {};
    const la = Number(lat ?? latitude);
    const lo = Number(lng ?? longitude);
    DeliveryCheckLog.create({
      available,
      matchMethod: available ? method : 'none',
      zoneName: zone?.name || '',
      gridLat: Number.isFinite(la) ? Math.round(la * 100) / 100 : undefined,
      gridLng: Number.isFinite(lo) ? Math.round(lo * 100) / 100 : undefined,
      placeId: String(placeId || uCode || ''),
      addressHint: String(address || '').slice(0, 120),
    }).catch(() => {});
  } catch (_) {}
};

// @desc    Check grocery eligibility for a location (hybrid: ID → geo)
// @route   POST /api/grocery-zones/check
// @access  Public
export const checkGroceryZone = async (req, res) => {
  try {
    const { lat, lng, latitude, longitude, placeId, uCode } = req.body;
    const resolved = await resolveGroceryZone({
      placeId, uCode, lat: lat ?? latitude, lng: lng ?? longitude,
    });
    if (!resolved) {
      const zones = await GroceryZone.find({ isActive: true }).select('name city district').sort({ name: 1 }).lean();
      logCheck(req, false, null);
      return res.status(200).json({
        success: true,
        available: false,
        message: `Grocery delivery is not available at your selected address. Grocery zones: ${zones.map((z) => z.name).join(', ') || 'none yet'}`,
        zones,
      });
    }
    const { zone, method } = resolved;
    logCheck(req, true, zone, method);
    res.status(200).json({
      success: true,
      available: true,
      matchMethod: method,
      message: `Grocery delivery available (${zone.name})`,
      data: {
        _id: zone._id,
        name: zone.name,
        city: zone.city,
        district: zone.district || '',
        deliveryCharge: zone.deliveryCharge,
        minimumOrderAmount: zone.minimumOrderAmount,
        estimatedDeliveryTime: zone.estimatedDeliveryTime,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    List active zones (public, for display)
// @route   GET /api/grocery-zones/active
// @access  Public
export const getActiveZones = async (req, res) => {
  try {
    const zones = await GroceryZone.find({ isActive: true })
      .select('name city district deliveryCharge minimumOrderAmount estimatedDeliveryTime centerLat centerLng radiusKm areas')
      .sort({ name: 1 });
    res.status(200).json({ success: true, count: zones.length, data: zones });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    List all zones (admin)
// @route   GET /api/grocery-zones
// @access  Private (DELIVERY_AREA_VIEW)
export const getZones = async (req, res) => {
  try {
    const zones = await GroceryZone.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: zones.length, data: zones });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Sanitize Barikoi area entries (placeId required, dedupe)
const cleanAreas = (areas) => {
  if (!Array.isArray(areas)) return [];
  const seen = new Set();
  const out = [];
  for (const a of areas.slice(0, 200)) {
    const placeId = String(a?.placeId || '').trim();
    if (!placeId || seen.has(placeId)) continue;
    seen.add(placeId);
    out.push({
      placeId,
      uCode: String(a?.uCode || '').trim(),
      name: String(a?.name || '').trim().slice(0, 120),
      city: String(a?.city || '').trim().slice(0, 80),
      lat: a?.lat != null ? Number(a.lat) : undefined,
      lng: a?.lng != null ? Number(a.lng) : undefined,
    });
  }
  return out;
};

// @desc    Create zone (admin — Barikoi areas + optional circle)
// @route   POST /api/grocery-zones
// @access  Private (DELIVERY_AREA_CREATE)
export const createZone = async (req, res) => {
  try {
    const zone = await GroceryZone.create({ ...req.body, areas: cleanAreas(req.body.areas) });
    logAudit(req, { action: 'ZONE_CREATE', entity: 'GroceryZone', entityId: zone._id, entityName: zone.name });
    res.status(201).json({ success: true, message: 'Grocery zone created', data: zone });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update zone (admin)
// @route   PUT /api/grocery-zones/:id
// @access  Private (DELIVERY_AREA_UPDATE)
export const updateZone = async (req, res) => {
  try {
    const zone = await GroceryZone.findById(req.params.id);
    if (!zone) return res.status(404).json({ success: false, message: 'Zone not found' });
    const fields = [
      'name', 'city', 'district', 'deliveryCharge', 'minimumOrderAmount',
      'estimatedDeliveryTime', 'isActive', 'status', 'centerLat', 'centerLng', 'radiusKm',
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        if (f === 'status' && !['ACTIVE', 'INACTIVE', 'COMING_SOON'].includes(req.body[f])) return;
        zone[f] = req.body[f];
      }
    });
    // Clear circle (set null) or replace area list
    if (req.body.clearCircle === true) {
      zone.centerLat = undefined;
      zone.centerLng = undefined;
      zone.boundary = undefined;
    }
    if (req.body.areas !== undefined) zone.areas = cleanAreas(req.body.areas);
    await zone.save(); // rebuilds boundary when circle present
    logAudit(req, { action: 'ZONE_UPDATE', entity: 'GroceryZone', entityId: zone._id, entityName: zone.name, details: { fields: Object.keys(req.body || {}) } });
    res.status(200).json({ success: true, message: 'Zone updated', data: zone });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Toggle zone status
// @route   PATCH /api/grocery-zones/:id/status
// @access  Private (DELIVERY_AREA_UPDATE)
export const toggleZoneStatus = async (req, res) => {
  try {
    const zone = await GroceryZone.findById(req.params.id);
    if (!zone) return res.status(404).json({ success: false, message: 'Zone not found' });
    zone.isActive = !zone.isActive;
    zone.status = zone.isActive ? 'ACTIVE' : 'INACTIVE';
    await zone.save();
    logAudit(req, { action: 'ZONE_STATUS', entity: 'GroceryZone', entityId: zone._id, entityName: zone.name, details: { status: zone.status } });
    res.status(200).json({ success: true, data: { id: zone._id, isActive: zone.isActive, status: zone.status } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete zone
// @route   DELETE /api/grocery-zones/:id
// @access  Private (DELIVERY_AREA_UPDATE)
export const deleteZone = async (req, res) => {
  try {
    const zone = await GroceryZone.findByIdAndDelete(req.params.id);
    if (!zone) return res.status(404).json({ success: false, message: 'Zone not found' });
    logAudit(req, { action: 'ZONE_DELETE', entity: 'GroceryZone', entityId: req.params.id, entityName: zone.name });
    res.status(200).json({ success: true, message: 'Zone deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

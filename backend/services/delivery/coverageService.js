import GroceryZone from '../../models/GroceryZone.js';
import { resolveGroceryZone } from '../../controllers/groceryZoneController.js';

// Delivery Coverage = the single routing input. Matching runs ONLY on
// Barikoi IDs (placeId/uCode) with geo fallback — NEVER on area names.
export const resolveCoverage = async ({ placeId, uCode, lat, lng, district = '' }) => {
  const resolved = await resolveGroceryZone({ placeId, uCode, lat, lng });
  if (!resolved) return null;
  const zone = resolved.zone;
  const ids = [placeId, uCode].filter(Boolean);
  const area = (zone.areas || []).find(
    (a) => ids.includes(a.placeId) || (a.uCode && ids.includes(a.uCode))
  );
  return {
    zoneId: zone._id,
    zoneName: zone.name,
    district: zone.district || district,
    areaName: area?.name || '',
    barikoiLocationId: placeId || uCode || '',
    status: zone.status, // ACTIVE | INACTIVE | COMING_SOON
    deliveryMode: zone.deliveryMode || 'OWN_DELIVERY',
    deliveryCharge: area?.charge ?? zone.deliveryCharge ?? 0,
    estimatedDeliveryTime: zone.estimatedDeliveryTime || '',
    riderCapacity: zone.riderCapacity ?? 0,
    matchMethod: resolved.method,
  };
};

// Own-network footprint for KPIs (zone expansion = network expansion)
export const networkFootprint = async () => {
  const zones = await GroceryZone.find({ status: 'ACTIVE', deliveryMode: 'OWN_DELIVERY' }).select('name district areas riderCapacity assignedRiders');
  const districts = new Set(zones.map((z) => z.district).filter(Boolean));
  return {
    activeOwnZones: zones.length,
    activeOwnAreas: zones.reduce((s, z) => s + (z.areas?.length || 0), 0),
    activeDistricts: districts.size,
    districts: [...districts],
    totalRiderCapacity: zones.reduce((s, z) => s + (z.riderCapacity || 0), 0),
  };
};

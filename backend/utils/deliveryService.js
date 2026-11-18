import Product from '../models/Product.js';
import Combo from '../models/Combo.js';
import NationwideDeliveryCharge from '../models/NationwideDeliveryCharge.js';
import FreeDeliveryRule from '../models/FreeDeliveryRule.js';
import ShipmentRule from '../models/ShipmentRule.js';
import AccountingSettings from '../models/AccountingSettings.js';
import { resolveGroceryZone } from '../controllers/groceryZoneController.js';
import { getVatConfig, computeVat } from '../services/vatService.js';

/**
 * CENTRALIZED delivery charge engine (single source of truth).
 *
 * Customer Address → Barikoi ID → Area/District → Cart Types →
 * Grocery Charge → Nationwide Charge → Shipment Rule → Free Delivery →
 * Final Delivery Charge
 *
 * Frontend-sent charges are NEVER trusted — order creation re-runs this.
 *
 * @param {object} opts
 * @param {string} opts.placeId Barikoi location id (optional)
 * @param {string} opts.uCode Barikoi uCode (optional)
 * @param {number} opts.lat
 * @param {number} opts.lng
 * @param {string} opts.district District/city hint for nationwide table
 * @param {Array} opts.items [{ productId?, comboId?, quantity? }]
 * @param {number} opts.subtotal Eligible order amount (for free delivery)
 */
export const calculateDeliveryCharge = async ({
  placeId,
  uCode,
  lat,
  lng,
  district,
  items = [],
  subtotal = 0,
} = {}) => {
  // 1. Classify lines (product flag is source of truth — never client type)
  let hasGrocery = false;
  let hasNationwide = false;
  const vatLines = [];
  for (const it of items) {
    if (it.productId) {
      const p = await Product.findById(it.productId).select('isGrocery salePrice regularPrice vatExempt').lean();
      if (!p) continue;
      if (p.isGrocery) hasGrocery = true;
      else hasNationwide = true;
      vatLines.push({ price: p.salePrice || p.regularPrice, qty: it.quantity, vatExempt: !!p.vatExempt });
    } else if (it.comboId) {
      const c = await Combo.findById(it.comboId).populate('items.product', 'isGrocery vatExempt').lean();
      if (!c) continue;
      if ((c.items || []).some((i) => i.product?.isGrocery)) hasGrocery = true;
      else hasNationwide = true;
      const constituents = c.items || [];
      vatLines.push({
        price: c.salePrice || c.regularPrice,
        qty: it.quantity,
        // Combo is exempt only if every constituent product is exempt
        vatExempt: constituents.length > 0 && constituents.every((i) => i.product?.vatExempt),
      });
    }
  }

  // 2. Grocery charge — hybrid zone resolve (ID → geo)
  let groceryCharge = 0;
  let zone = null;
  let matchMethod = null;
  if (hasGrocery) {
    const resolved = await resolveGroceryZone({ placeId, uCode, lat, lng });
    if (resolved) {
      zone = resolved.zone;
      matchMethod = resolved.method;
      // Per-area charge wins (spec table), else zone default
      const ids = [placeId, uCode].filter(Boolean);
      const areaHit = (zone.areas || []).find(
        (a) => ids.includes(a.placeId) || (a.uCode && ids.includes(a.uCode))
      );
      groceryCharge =
        areaHit?.charge != null ? areaHit.charge : (zone.deliveryCharge || 0);
    }
  }

  // 3. Nationwide charge — district table (case-insensitive), else 'Other'
  let nationwideCharge = 0;
  let nationwideDistrict = null;
  if (hasNationwide) {
    const key = String(district || '').trim();
    let row = null;
    if (key) {
      row = await NationwideDeliveryCharge.findOne({
        district: { $regex: `^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        isActive: true,
      }).lean();
    }
    if (!row) {
      row = await NationwideDeliveryCharge.findOne({ district: 'Other', isActive: true }).lean();
    }
    if (row) {
      nationwideCharge = row.charge || 0;
      nationwideDistrict = row.district;
    }
  }

  // 4. Shipment rule — SINGLE_SHIPMENT: MAX of present legs
  const shipment = await ShipmentRule.findOne().lean();
  const shipmentMode = shipment?.mode || 'SINGLE_SHIPMENT';
  const legs = [];
  if (hasGrocery) legs.push(groceryCharge);
  if (hasNationwide) legs.push(nationwideCharge);
  let deliveryCharge = legs.length ? Math.max(...legs) : 0;

  // 5. Free delivery check (segment must be present in cart)
  const rule = await FreeDeliveryRule.findOne().sort({ updatedAt: -1 }).lean();
  let freeDelivery = false;
  if (rule?.isActive && Number(subtotal) >= Number(rule.minimumOrderAmount || 0)) {
    if (rule.applicableTo === 'ALL' && (hasGrocery || hasNationwide)) freeDelivery = true;
    else if (rule.applicableTo === 'GROCERY' && hasGrocery) freeDelivery = true;
    else if (rule.applicableTo === 'NATIONWIDE' && hasNationwide) freeDelivery = true;
  }
  if (freeDelivery) deliveryCharge = 0;

  // 6. VAT via central engine (BD NBR: EXCLUSIVE adds, INCLUSIVE display-only).
  // `subtotal` here is already net of coupon discount (both call sites).
  let vat = { mode: 'EXCLUSIVE', rate: 0, name: 'VAT', bin: '', taxableBase: 0, exemptBase: 0, vatAmount: 0, vatAdditive: 0 };
  try {
    const cfg = await getVatConfig();
    vat = computeVat({ lines: vatLines, netSubtotal: Number(subtotal) || 0, settings: cfg });
  } catch (_) {}
  const taxAmount = vat.vatAmount; // legacy key = display value (order snapshot)
  const taxRate = vat.rate;

  return {
    hasGrocery,
    hasNationwide,
    groceryCharge,
    nationwideCharge,
    nationwideDistrict,
    zone: zone
      ? { _id: zone._id, name: zone.name, district: zone.district || '', deliveryCharge: zone.deliveryCharge }
      : null,
    matchMethod,
    shipmentMode,
    freeDelivery,
    freeDeliveryRule: rule
      ? { minimumOrderAmount: rule.minimumOrderAmount, applicableTo: rule.applicableTo, isActive: rule.isActive }
      : null,
    deliveryCharge,
    taxAmount, // display value (kept for backward compat)
    taxRate,
    // VAT regime detail (checkout display + order snapshot)
    vatMode: vat.mode,
    vatName: vat.name,
    vatBin: vat.bin,
    vatTaxableBase: vat.taxableBase,
    vatExemptBase: vat.exemptBase,
    vatAdditive: vat.vatAdditive,
  };
};

export default { calculateDeliveryCharge };

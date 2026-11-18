import NationwideDeliveryCharge from '../models/NationwideDeliveryCharge.js';
import FreeDeliveryRule from '../models/FreeDeliveryRule.js';
import ShipmentRule from '../models/ShipmentRule.js';
import Order from '../models/Order.js';
import DeliveryCheckLog from '../models/DeliveryCheckLog.js';
import AuditLog from '../models/AuditLog.js';
import { calculateDeliveryCharge } from '../utils/deliveryService.js';
import { logAudit } from '../utils/auditLog.js';

// ---------- Public ----------

// @desc    Calculate delivery breakdown (spec request/response)
// @route   POST /api/delivery/calculate
// @access  Public
export const listSlots = async (req, res) => {
  try {
    const { listSlots } = await import('../services/delivery/slotService.js');
    const data = await listSlots({ zone: req.query.zone || null, applicableTo: req.query.for || null, date: req.query.date || null });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const calculate = async (req, res) => {
  try {
    const { barikoiLocationId, placeId, uCode, lat, lng, latitude, longitude, district, city, items, eligibleSubtotal, subtotal } = req.body;
    const result = await calculateDeliveryCharge({
      placeId: placeId || barikoiLocationId,
      uCode,
      lat: lat ?? latitude,
      lng: lng ?? longitude,
      district: district || city,
      items: items || [],
      subtotal: eligibleSubtotal ?? subtotal ?? 0,
    });
    res.json({
      success: true,
      data: {
        groceryCharge: result.groceryCharge,
        nationwideCharge: result.nationwideCharge,
        shipmentMode: result.shipmentMode,
        freeDelivery: result.freeDelivery,
        deliveryCharge: result.deliveryCharge,
        taxAmount: result.taxAmount,
        taxRate: result.taxRate,
        vatMode: result.vatMode,
        vatName: result.vatName,
        vatTaxableBase: result.vatTaxableBase,
        vatExemptBase: result.vatExemptBase,
        vatAdditive: result.vatAdditive,
        zone: result.zone,
        matchMethod: result.matchMethod,
        hasGrocery: result.hasGrocery,
        hasNationwide: result.hasNationwide,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Active free-delivery rule (for cart progress hint)
// @route   GET /api/delivery/free-delivery
// @access  Public
export const getPublicFreeDelivery = async (req, res) => {
  try {
    const rule = await FreeDeliveryRule.findOne().sort({ updatedAt: -1 }).lean();
    if (!rule?.isActive) return res.json({ success: true, data: { isActive: false } });
    res.json({
      success: true,
      data: {
        isActive: true,
        minimumOrderAmount: rule.minimumOrderAmount,
        applicableTo: rule.applicableTo,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- Admin: nationwide charges ----------

export const getNationwide = async (req, res) => {
  try {
    const rows = await NationwideDeliveryCharge.find().sort({ district: 1 });
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const upsertNationwide = async (req, res) => {
  try {
    const { district, charge, isActive } = req.body;
    if (!district || charge == null) {
      return res.status(400).json({ success: false, message: 'District and charge are required' });
    }
    const row = await NationwideDeliveryCharge.findOneAndUpdate(
      { district: { $regex: `^${String(district).trim()}$`, $options: 'i' } },
      {
        district: String(district).trim(),
        charge: Number(charge),
        ...(isActive !== undefined ? { isActive: isActive === true } : {}),
      },
      { new: true, upsert: true, runValidators: true }
    );
    logAudit(req, { action: 'NATIONWIDE_SAVE', entity: 'NationwideCharge', entityId: row._id, entityName: row.district, details: { charge: row.charge, isActive: row.isActive } });
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteNationwide = async (req, res) => {
  try {
    const row = await NationwideDeliveryCharge.findByIdAndDelete(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    logAudit(req, { action: 'NATIONWIDE_DELETE', entity: 'NationwideCharge', entityId: req.params.id, entityName: row.district });
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- Admin: free delivery + shipment ----------

export const getFreeDelivery = async (req, res) => {
  try {
    const rule = await FreeDeliveryRule.findOne().sort({ updatedAt: -1 });
    const shipment = await ShipmentRule.findOne();
    res.json({ success: true, data: { rule: rule || { isActive: false }, shipment: shipment || { mode: 'SINGLE_SHIPMENT' } } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFreeDelivery = async (req, res) => {
  try {
    const { isActive, minimumOrderAmount, applicableTo } = req.body;
    let rule = await FreeDeliveryRule.findOne().sort({ updatedAt: -1 });
    if (!rule) rule = new FreeDeliveryRule();
    if (isActive !== undefined) rule.isActive = isActive === true;
    if (minimumOrderAmount !== undefined) rule.minimumOrderAmount = Math.max(0, Number(minimumOrderAmount) || 0);
    if (applicableTo !== undefined) {
      if (!['ALL', 'GROCERY', 'NATIONWIDE'].includes(applicableTo)) {
        return res.status(400).json({ success: false, message: 'Invalid applicableTo' });
      }
      rule.applicableTo = applicableTo;
    }
    await rule.save();
    logAudit(req, { action: 'FREE_DELIVERY_UPDATE', entity: 'FreeDelivery', entityName: 'rule', details: { isActive: rule.isActive, minimumOrderAmount: rule.minimumOrderAmount, applicableTo: rule.applicableTo } });
    res.json({ success: true, message: 'Free delivery rule saved', data: rule });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getShipmentRule = async (req, res) => {
  try {
    let rule = await ShipmentRule.findOne();
    if (!rule) rule = await ShipmentRule.create({});
    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- Analytics ----------

const rangeFilter = (req) => {
  const now = new Date();
  const from = req.query.from ? new Date(req.query.from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const to = req.query.to ? new Date(req.query.to) : now;
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { createdAt: { $gte: from, $lte: to } };
};

// @desc    Delivery analytics overview
// @route   GET /api/delivery/analytics/overview?from&to
// @access  Private (REPORT_VIEW or DELIVERY_AREA_VIEW)
export const getDeliveryAnalytics = async (req, res) => {
  try {
    const match = { ...rangeFilter(req), orderStatus: { $ne: 'Cancelled' } };

    const [totals] = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          deliveryRevenue: { $sum: '$deliveryCharge' },
          freeCount: { $sum: { $cond: [{ $eq: ['$deliveryCharge', 0] }, 1, 0] } },
          paidCount: { $sum: { $cond: [{ $gt: ['$deliveryCharge', 0] }, 1, 0] } },
          paidRevenue: {
            $sum: { $cond: [{ $gt: ['$deliveryCharge', 0] }, '$deliveryCharge', 0] },
          },
        },
      },
    ]);

    // cancel-safe free count via deliveryInfo flag too
    const freeInfo = await Order.countDocuments({ ...rangeFilter(req), orderStatus: { $ne: 'Cancelled' }, 'deliveryInfo.freeDelivery': true });

    const topAreas = await Order.aggregate([
      { $match: match },
      { $group: { _id: '$deliveryArea', orders: { $sum: 1 }, revenue: { $sum: '$deliveryCharge' } } },
      { $sort: { orders: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'deliveryareas', localField: '_id', foreignField: '_id', as: 'a' } },
      { $unwind: { path: '$a', preserveNullAndEmptyArrays: true } },
      { $project: { area: '$a.name', city: '$a.city', orders: 1, revenue: 1 } },
    ]);

    const topZones = await Order.aggregate([
      { $match: { ...match, 'shippingAddress.zone': { $ne: '' } } },
      { $group: { _id: '$shippingAddress.zone', orders: { $sum: 1 }, revenue: { $sum: '$deliveryCharge' } } },
      { $sort: { orders: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, zone: '$_id', orders: 1, revenue: 1 } },
    ]);

    // Unavailable hotspots (misses, grouped by ~1km grid)
    const unavailable = await DeliveryCheckLog.aggregate([
      { $match: { ...rangeFilter(req), available: false } },
      {
        $group: {
          _id: { lat: '$gridLat', lng: '$gridLng' },
          misses: { $sum: 1 },
          hint: { $first: '$addressHint' },
        },
      },
      { $sort: { misses: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, lat: '$_id.lat', lng: '$_id.lng', misses: 1, hint: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        totals: {
          orders: totals?.orders || 0,
          deliveryRevenue: totals?.deliveryRevenue || 0,
          paidDelivery: { count: totals?.paidCount || 0, revenue: totals?.paidRevenue || 0 },
          freeDelivery: { count: Math.max(totals?.freeCount || 0, freeInfo), revenue: 0 },
          avgCharge: totals?.orders ? +((totals.deliveryRevenue || 0) / totals.orders).toFixed(2) : 0,
        },
        topAreas,
        topZones,
        unavailable,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delivery audit log
// @route   GET /api/delivery/audit?entity&page&limit
// @access  Private (REPORT_VIEW or DELIVERY_AREA_VIEW)
export const getAuditLog = async (req, res) => {
  try {
    const { entity, page = 1, limit = 20 } = req.query;
    const q = {};
    if (entity) q.entity = entity;
    const skip = (Number(page) - 1) * Number(limit);
    const [list, total] = await Promise.all([
      AuditLog.find(q).populate('actor', 'name role').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      AuditLog.countDocuments(q),
    ]);
    res.json({
      success: true, data: list, total,
      page: Number(page), pages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

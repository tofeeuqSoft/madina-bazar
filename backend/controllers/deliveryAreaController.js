import DeliveryArea from '../models/DeliveryArea.js';
import { logAudit } from '../utils/auditLog.js';

// @desc    Get all delivery areas
// @route   GET /api/delivery-areas
// @access  Public
export const getDeliveryAreas = async (req, res) => {
  try {
    const { isActive, city, parent } = req.query;

    const query = {};

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    if (city) {
      const { escapeRegExp } = await import('../utils/safeRegex.js');
      query.city = { $regex: escapeRegExp(city), $options: 'i' };
    }
    if (parent === 'null' || parent === '') {
      query.parentArea = null;
    } else if (parent) {
      query.parentArea = parent;
    }

    const areas = await DeliveryArea.find(query)
      .populate('parentArea', 'name city')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: areas.length,
      data: areas,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get only active delivery areas (for checkout)
// @route   GET /api/delivery-areas/active
// @access  Public
export const getActiveDeliveryAreas = async (req, res) => {
  try {
    const areas = await DeliveryArea.find({ isActive: true })
      .select('name city deliveryCharge minimumOrderAmount estimatedDeliveryTime groceryDelivery deliveryNote')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: areas.length,
      data: areas,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single delivery area
// @route   GET /api/delivery-areas/:id
// @access  Public
export const getDeliveryArea = async (req, res) => {
  try {
    const area = await DeliveryArea.findById(req.params.id).populate(
      'parentArea',
      'name city'
    );

    if (!area) {
      return res.status(404).json({ success: false, message: 'Delivery area not found' });
    }

    res.status(200).json({
      success: true,
      data: area,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create delivery area
// @route   POST /api/delivery-areas
// @access  Private (DELIVERY_AREA_CREATE)
export const createDeliveryArea = async (req, res) => {
  try {
    const {
      name,
      city,
      parentArea,
      deliveryCharge,
      minimumOrderAmount,
      estimatedDeliveryTime,
      isActive,
      groceryDelivery,
      deliveryNote,
      barikoiAreaId,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Area name is required',
      });
    }

    // Check duplicate name in same city
    const { escapeRegExp } = await import('../utils/safeRegex.js');
    const exists = await DeliveryArea.findOne({
      name: { $regex: `^${escapeRegExp(name)}$`, $options: 'i' },
      city: city || 'Dhaka',
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Delivery area with this name already exists in this city',
      });
    }

    if (parentArea) {
      const parent = await DeliveryArea.findById(parentArea);
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: 'Parent area not found',
        });
      }
    }

    const area = await DeliveryArea.create({
      name,
      city: city || 'Dhaka',
      parentArea: parentArea || null,
      deliveryCharge: deliveryCharge ?? 60,
      minimumOrderAmount: minimumOrderAmount ?? 0,
      estimatedDeliveryTime: estimatedDeliveryTime || '2-4 Hours',
      isActive: isActive !== undefined ? isActive : true,
      groceryDelivery: groceryDelivery === true,
      deliveryNote: deliveryNote || '',
      barikoiAreaId: barikoiAreaId || '',
    });

    logAudit(req, { action: 'AREA_CREATE', entity: 'DeliveryArea', entityId: area._id, entityName: area.name });

    res.status(201).json({
      success: true,
      message: 'Delivery area created successfully',
      data: area,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update delivery area
// @route   PUT /api/delivery-areas/:id
// @access  Private (DELIVERY_AREA_UPDATE)
export const updateDeliveryArea = async (req, res) => {
  try {
    const area = await DeliveryArea.findById(req.params.id);
    if (!area) {
      return res.status(404).json({ success: false, message: 'Delivery area not found' });
    }

    const {
      name,
      city,
      parentArea,
      deliveryCharge,
      minimumOrderAmount,
      estimatedDeliveryTime,
      isActive,
      groceryDelivery,
      deliveryNote,
      barikoiAreaId,
    } = req.body;

    if (name) area.name = name;
    if (city) area.city = city;
    if (parentArea !== undefined) area.parentArea = parentArea || null;
    if (deliveryCharge !== undefined) area.deliveryCharge = deliveryCharge;
    if (minimumOrderAmount !== undefined) area.minimumOrderAmount = minimumOrderAmount;
    if (estimatedDeliveryTime) area.estimatedDeliveryTime = estimatedDeliveryTime;
    if (isActive !== undefined) area.isActive = isActive;
    if (groceryDelivery !== undefined) area.groceryDelivery = groceryDelivery === true;
    if (deliveryNote !== undefined) area.deliveryNote = String(deliveryNote).slice(0, 300);
    if (barikoiAreaId !== undefined) area.barikoiAreaId = barikoiAreaId;

    await area.save();

    logAudit(req, {
      action: 'AREA_UPDATE', entity: 'DeliveryArea', entityId: area._id, entityName: area.name,
      details: {
        deliveryCharge: area.deliveryCharge,
        groceryDelivery: area.groceryDelivery,
        isActive: area.isActive,
        changedFields: Object.keys(req.body || {}),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Delivery area updated successfully',
      data: area,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle delivery area status (Enable / Disable)
// @route   PATCH /api/delivery-areas/:id/status
// @access  Private (DELIVERY_AREA_DISABLE or DELIVERY_AREA_UPDATE)
export const toggleDeliveryAreaStatus = async (req, res) => {
  try {
    const area = await DeliveryArea.findById(req.params.id);
    if (!area) {
      return res.status(404).json({ success: false, message: 'Delivery area not found' });
    }

    area.isActive = !area.isActive;
    await area.save();

    logAudit(req, { action: 'AREA_STATUS', entity: 'DeliveryArea', entityId: area._id, entityName: area.name, details: { isActive: area.isActive } });

    res.status(200).json({
      success: true,
      message: `Delivery area ${area.isActive ? 'enabled' : 'disabled'} successfully`,
      data: {
        id: area._id,
        name: area.name,
        isActive: area.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete delivery area
// @route   DELETE /api/delivery-areas/:id
// @access  Private (DELIVERY_AREA_UPDATE / Super Admin)
export const deleteDeliveryArea = async (req, res) => {
  try {
    const area = await DeliveryArea.findById(req.params.id);
    if (!area) {
      return res.status(404).json({ success: false, message: 'Delivery area not found' });
    }

    // Check if has child areas
    const childCount = await DeliveryArea.countDocuments({ parentArea: area._id });
    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete. This area has ${childCount} child area(s).`,
      });
    }

    await area.deleteOne();

    logAudit(req, { action: 'AREA_DELETE', entity: 'DeliveryArea', entityId: req.params.id, entityName: area.name });

    res.status(200).json({
      success: true,
      message: 'Delivery area deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check if an area is available for delivery
// @route   POST /api/delivery-areas/check
// @access  Public
export const checkDeliveryAvailability = async (req, res) => {
  try {
    const { areaId, orderAmount, hasGrocery } = req.body;

    if (!areaId) {
      return res.status(400).json({
        success: false,
        message: 'Area ID is required',
      });
    }

    const area = await DeliveryArea.findById(areaId);

    if (!area) {
      return res.status(404).json({
        success: false,
        available: false,
        message: 'Delivery area not found',
      });
    }

    if (!area.isActive) {
      return res.status(200).json({
        success: true,
        available: false,
        message: 'Delivery is not available in this area currently',
      });
    }

    // Grocery items only go to grocery-enabled areas
    if (hasGrocery && !area.groceryDelivery) {
      const groceryAreas = await DeliveryArea.find({ isActive: true, groceryDelivery: true })
        .select('name city')
        .sort({ name: 1 });
      return res.status(200).json({
        success: true,
        available: false,
        groceryAvailable: false,
        message: `Grocery products are delivered only in: ${groceryAreas.map((a) => a.name).join(', ') || 'selected areas'}`,
        groceryAreas: groceryAreas.map((a) => ({ _id: a._id, name: a.name, city: a.city })),
      });
    }

    if (orderAmount && orderAmount < area.minimumOrderAmount) {
      return res.status(200).json({
        success: true,
        available: false,
        message: `Minimum order amount for this area is ৳${area.minimumOrderAmount}`,
        minimumOrderAmount: area.minimumOrderAmount,
        deliveryCharge: area.deliveryCharge,
      });
    }

    res.status(200).json({
      success: true,
      available: true,
      groceryAvailable: true,
      message: 'Delivery available',
      data: {
        area: area.name,
        deliveryCharge: area.deliveryCharge,
        estimatedDeliveryTime: area.estimatedDeliveryTime,
        minimumOrderAmount: area.minimumOrderAmount,
        groceryDelivery: area.groceryDelivery,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

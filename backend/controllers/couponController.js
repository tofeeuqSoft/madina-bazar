import Coupon from '../models/Coupon.js';

// @desc    Get all coupons (Admin)
// @route   GET /api/coupons
// @access  Private (COUPON_VIEW)
export const getCoupons = async (req, res) => {
  try {
    const { isActive, search, page = 1, limit = 20 } = req.query;

    const query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      const { escapeRegExp } = await import('../utils/safeRegex.js');
      query.code = { $regex: escapeRegExp(search), $options: 'i' };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Coupon.countDocuments(query);

    res.status(200).json({
      success: true,
      count: coupons.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: coupons,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single coupon
// @route   GET /api/coupons/:id
// @access  Private (COUPON_VIEW)
export const getCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    res.status(200).json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Validate coupon (for checkout)
// @route   POST /api/coupons/validate
// @access  Private
export const validateCoupon = async (req, res) => {
  try {
    // Single evaluator (same as checkout) — items optional for a quick check.
    const { evaluateCoupon } = await import('../services/couponService.js');
    const { coupon, discount, eligibleSubtotal } = await evaluateCoupon({
      code: req.body.code,
      userId: req.user?.id || null,
      items: req.body.items || [],
      subtotal: Number(req.body.orderAmount) || 0,
    });

    res.status(200).json({
      success: true,
      valid: true,
      message: 'Coupon is valid',
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: discount,
        eligibleSubtotal,
        maximumDiscount: coupon.maximumDiscount,
        minimumOrderAmount: coupon.minimumOrderAmount,
      },
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, valid: false, message: error.message });
  }
};

// @desc    Create coupon
// @route   POST /api/coupons
// @access  Private (COUPON_CREATE)
export const createCoupon = async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      minimumOrderAmount,
      maximumDiscount,
      expiryDate,
      startDate,
      products,
      categories,
      usageLimit,
      maxPerUser,
      isActive,
    } = req.body;

    if (!code || !discountType || discountValue === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Code, discount type and discount value are required',
      });
    }

    if (!['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({
        success: false,
        message: 'Discount type must be percentage or fixed',
      });
    }

    const exists = await Coupon.findOne({ code: code.toUpperCase() });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists',
      });
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      minimumOrderAmount: minimumOrderAmount || 0,
      maximumDiscount,
      expiryDate,
      startDate: startDate || null,
      products: Array.isArray(products) ? products : [],
      categories: Array.isArray(categories) ? categories : [],
      usageLimit,
      maxPerUser: maxPerUser ?? null,
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      data: coupon,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update coupon
// @route   PUT /api/coupons/:id
// @access  Private (COUPON_UPDATE)
export const updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    const {
      code,
      discountType,
      discountValue,
      minimumOrderAmount,
      maximumDiscount,
      expiryDate,
      startDate,
      products,
      categories,
      usageLimit,
      maxPerUser,
      isActive,
    } = req.body;

    if (code && code.toUpperCase() !== coupon.code) {
      const exists = await Coupon.findOne({ code: code.toUpperCase() });
      if (exists) {
        return res.status(400).json({
          success: false,
          message: 'Coupon code already exists',
        });
      }
      coupon.code = code.toUpperCase();
    }

    if (discountType) coupon.discountType = discountType;
    if (discountValue !== undefined) coupon.discountValue = discountValue;
    if (minimumOrderAmount !== undefined) coupon.minimumOrderAmount = minimumOrderAmount;
    if (maximumDiscount !== undefined) coupon.maximumDiscount = maximumDiscount;
    if (expiryDate !== undefined) coupon.expiryDate = expiryDate;
    if (startDate !== undefined) coupon.startDate = startDate || null;
    if (products !== undefined) coupon.products = Array.isArray(products) ? products : [];
    if (categories !== undefined) coupon.categories = Array.isArray(categories) ? categories : [];
    if (usageLimit !== undefined) coupon.usageLimit = usageLimit;
    if (maxPerUser !== undefined) coupon.maxPerUser = maxPerUser || null;
    if (isActive !== undefined) coupon.isActive = isActive;

    await coupon.save();

    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      data: coupon,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle coupon status
// @route   PATCH /api/coupons/:id/status
// @access  Private (COUPON_UPDATE)
export const toggleCouponStatus = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.status(200).json({
      success: true,
      message: `Coupon ${coupon.isActive ? 'enabled' : 'disabled'} successfully`,
      data: {
        id: coupon._id,
        code: coupon.code,
        isActive: coupon.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete coupon
// @route   DELETE /api/coupons/:id
// @access  Private (COUPON_DELETE)
export const deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    await coupon.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

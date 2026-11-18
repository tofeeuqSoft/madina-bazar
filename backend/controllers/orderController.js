import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Combo from '../models/Combo.js';
import DeliveryArea from '../models/DeliveryArea.js';
import Coupon from '../models/Coupon.js';
import { notifyOrderPlaced, notifyOrderStatus } from '../utils/notifications.js';
import { resolveGroceryZone } from './groceryZoneController.js';
import { calculateDeliveryCharge } from '../utils/deliveryService.js';
import { recordSale, recordPayment, recordRefund } from '../services/accountingService.js';
import Return from '../models/Return.js';

// Helper: Generate unique order number
const generateOrderNumber = async () => {
  const count = await Order.countDocuments();
  const timestamp = Date.now().toString().slice(-8);
  return `MB${timestamp}${(count + 1).toString().padStart(4, '0')}`;
};

// @desc    Create new order (Checkout)
// @route   POST /api/orders
// @access  Private (Customer)
export const createOrder = async (req, res) => {
  try {
    const {
      shippingAddress,
      deliveryAreaId,
      paymentMethod,
      couponCode,
      notes,
    } = req.body;

    // Validation
    if (!shippingAddress || !deliveryAreaId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Shipping address, delivery area and payment method are required',
      });
    }

    // Idempotency: key claimed at deduct stage (below) so validation
    // failures never hold it — but a COMPLETED replay is read-only and
    // answered here, before cart checks (cart is cleared after success).
    const clientKey = String(req.headers['idempotency-key'] || req.body.clientKey || '').trim();
    let idem = null;
    if (clientKey) {
      const IdempotencyKeyEarly = (await import('../models/IdempotencyKey.js')).default;
      const done = await IdempotencyKeyEarly.findOne({ key: clientKey, user: req.user.id, status: 'COMPLETED' });
      if (done?.order) {
        const existing = await Order.findById(done.order)
          .populate('customer', 'name email phone')
          .populate('deliveryArea', 'name deliveryCharge estimatedDeliveryTime')
          .populate('orderItems.product', 'name slug images')
          .populate('orderItems.combo', 'name slug images');
        if (existing) {
          return res.status(200).json({ success: true, message: 'Order already placed', data: existing, duplicate: true });
        }
      }
    }

    const allowedPayments = ['COD', 'BKASH', 'NAGAD', 'SSLCOMMERZ'];
    if (!allowedPayments.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method',
      });
    }

    // Get user cart
    const cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product')
      .populate('items.combo');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
      });
    }

    // Validate delivery area
    const deliveryArea = await DeliveryArea.findById(deliveryAreaId);
    if (!deliveryArea || !deliveryArea.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Selected delivery area is not available',
      });
    }

    // Build order items + calculate subtotal + check stock
    const orderItems = [];
    let subtotal = 0;
    let hasGrocery = false;
    const comboIds = [];

    for (const item of cart.items) {
      if (item.product) {
        const product = item.product;
        if (!product.isActive) {
          return res.status(400).json({
            success: false,
            message: `Product "${product.name}" is currently unavailable`,
          });
        }
        if (product.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
          });
        }

        const price = product.salePrice || product.regularPrice;
        orderItems.push({
          product: product._id,
          name: product.name,
          quantity: item.quantity,
          price,
          unit: product.unit,
          size: item.size || '',
          color: item.color || '',
          cost: product.costPrice || 0, // historical cost snapshot
        });
        subtotal += price * item.quantity;
        if (product.isGrocery) hasGrocery = true;
      } else if (item.combo) {
        const combo = item.combo;
        if (!combo.isActive) {
          return res.status(400).json({
            success: false,
            message: `Combo "${combo.name}" is currently unavailable`,
          });
        }

        const price = combo.salePrice || combo.regularPrice;
        orderItems.push({
          combo: combo._id,
          name: combo.name,
          quantity: item.quantity,
          price,
        });
        subtotal += price * item.quantity;
        comboIds.push(combo._id);
      }
    }

    // Combo containing any grocery product counts as grocery.
    // Combo unit cost snapshot = sum of constituent product costs.
    if (comboIds.length) {
      const combos = await Combo.find({ _id: { $in: comboIds } }).populate('items.product', 'isGrocery costPrice');
      if (combos.some((c) => (c.items || []).some((i) => i.product?.isGrocery))) {
        hasGrocery = true;
      }
      const costByCombo = {};
      for (const c of combos) {
        costByCombo[String(c._id)] = (c.items || []).reduce(
          (s, i) => s + (Number(i.product?.costPrice) || 0) * (Number(i.quantity) || 0),
          0
        );
      }
      for (const oi of orderItems) {
        if (oi.combo) oi.cost = costByCombo[String(oi.combo)] || 0;
      }
    }

    // Grocery scope gate (Layer 4: backend eligibility — hybrid).
    // Barikoi ID match first, geo fallback; no coords → area flag.
    // Ready-to-Cook / Combo / Other deliver to ALL active areas.
    if (hasGrocery) {
      const hasLocation = shippingAddress.placeId || shippingAddress.uCode ||
        (Number.isFinite(Number(shippingAddress.latitude)) && Number.isFinite(Number(shippingAddress.longitude)));
      if (hasLocation) {
        const resolved = await resolveGroceryZone({
          placeId: shippingAddress.placeId,
          uCode: shippingAddress.uCode,
          lat: shippingAddress.latitude,
          lng: shippingAddress.longitude,
        });
        if (!resolved) {
          return res.status(400).json({
            success: false,
            message: 'Grocery delivery is not available at your selected address. Remove grocery items or choose an address inside a grocery zone.',
          });
        }
        shippingAddress.zone = resolved.zone.name; // snapshot for admin/rider/reports
        shippingAddress.uCode = shippingAddress.uCode || '';
      } else if (!deliveryArea.groceryDelivery) {
        const groceryAreas = await DeliveryArea.find({ isActive: true, groceryDelivery: true })
          .select('name city')
          .sort({ name: 1 });
        return res.status(400).json({
          success: false,
          message: `Grocery products are delivered only in: ${groceryAreas.map((a) => `${a.name}${a.city ? ` (${a.city})` : ''}`).join(', ') || 'selected areas'}. Please remove grocery items or choose a grocery area.`,
          groceryAreas: groceryAreas.map((a) => ({ _id: a._id, name: a.name, city: a.city })),
        });
      }
    }

    // Minimum order check
    if (subtotal < deliveryArea.minimumOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount for ${deliveryArea.name} is ৳${deliveryArea.minimumOrderAmount}`,
      });
    }

    // Coupon handling
    let discount = 0;
    let appliedCoupon = null;

    if (couponCode) {
      try {
        const { evaluateCoupon } = await import('../services/couponService.js');
        const { coupon, discount: disc } = await evaluateCoupon({
          code: couponCode,
          userId: req.user.id,
          items: (cart.items || []).map((i) => ({
            productId: i.product?._id || i.product,
            price: i.product?.salePrice || i.product?.regularPrice || 0,
            quantity: i.quantity,
            categoryId: i.product?.category?._id || i.product?.category,
          })),
          subtotal,
        });
        discount = disc;
        appliedCoupon = coupon.code;
      } catch (e) {
        return res.status(e.statusCode || 400).json({ success: false, message: e.message });
      }
    }

    const deliveryCharge = deliveryArea.deliveryCharge;
    const totalAmount = Math.max(0, subtotal + deliveryCharge - discount);

    // CENTRALIZED recompute — frontend charge never trusted.
    // Barikoi ID → zone/area → legs → shipment MAX → free delivery.
    let deliveryCalc = null;
    try {
      deliveryCalc = await calculateDeliveryCharge({
        placeId: shippingAddress.placeId,
        uCode: shippingAddress.uCode,
        lat: shippingAddress.latitude,
        lng: shippingAddress.longitude,
        district: shippingAddress.city,
        items: cart.items.map((i) => ({
          productId: i.product?._id || i.product,
          comboId: i.combo?._id || i.combo,
          quantity: i.quantity,
        })),
        subtotal: Math.max(0, subtotal - discount),
      });
    } catch (_) {}
    const finalCharge = deliveryCalc ? deliveryCalc.deliveryCharge : deliveryCharge;
    // VAT snapshot via central engine. EXCLUSIVE adds to total; INCLUSIVE is
    // display-only (already inside prices); DISABLED/0 hides the line.
    const taxAmount = deliveryCalc?.taxAmount ?? 0;
    const taxAdditive = deliveryCalc?.vatAdditive ?? taxAmount;
    const taxMode = deliveryCalc?.vatMode || 'EXCLUSIVE';
    const taxRateSnap = deliveryCalc?.taxRate ?? 0;
    const taxNameSnap = deliveryCalc?.vatName || 'VAT';
    const finalTotal = Math.max(0, subtotal + finalCharge - discount + taxAdditive);

    // Delivery slot (optional): capacity-guarded, snapshot the label.
    let slotSnap = { slot: null, date: null, label: '' };
    if (req.body.deliverySlot?.slotId) {
      try {
        const { assertSlotAvailable } = await import('../services/delivery/slotService.js');
        const slot = await assertSlotAvailable({ slotId: req.body.deliverySlot.slotId, date: req.body.deliverySlot.date });
        const d = new Date(`${req.body.deliverySlot.date}T00:00:00`);
        slotSnap = { slot: slot._id, date: d, label: slot.label || slot.name };
      } catch (e) {
        return res.status(e.statusCode || 400).json({ success: false, message: e.message, code: e.code || 'SLOT_INVALID' });
      }
    }

    // Create order
    const orderNumber = await generateOrderNumber();

    // Claim the idempotency key here (after all validation): same clientKey =
    // same order across double-tap / retry / multi-instance race.
    if (clientKey) {
      const IdempotencyKey = (await import('../models/IdempotencyKey.js')).default;
      const takeOverAfterMs = 2 * 60 * 1000; // crashed worker → allow retry
      let isNewKey = false;
      try {
        idem = await IdempotencyKey.create({ key: clientKey, user: req.user.id });
        isNewKey = true; // fresh key = this request owns it → proceed, never 409
      } catch (e) {
        if (e?.code !== 11000) throw e;
        idem = await IdempotencyKey.findOne({ key: clientKey, user: req.user.id });
      }
      if (idem?.status === 'COMPLETED' && !idem.order) {
        idem.status = 'IN_PROGRESS'; // order ref lost — take over
        await idem.save();
      } else if (!isNewKey && idem?.status === 'IN_PROGRESS' && Date.now() - new Date(idem.createdAt).getTime() < takeOverAfterMs) {
        return res.status(409).json({ success: false, message: 'Order is already being placed — please wait', code: 'IDEMPOTENT_IN_PROGRESS' });
      } else if (idem?.status === 'FAILED') {
        idem.status = 'IN_PROGRESS';
        await idem.save();
      }
    }

    // Reserve-then-deduct BEFORE creating the order so a race can never
    // create an order without stock (atomic guard inside inventoryService).
    // Combos decrement their constituent products proportionally.
    const { deductStock, deductComboStock, returnStock, returnComboStock } = await import('../services/inventory/stockService.js');
    // Lines actually deducted (skip idempotent replays) — compensated if the
    // order fails to persist below, so stock can never leak without an order.
    const deducted = [];
    try {
      for (const item of orderItems) {
        if (item.product) {
          const r = await deductStock({
            productId: item.product,
            size: item.size || '',
            color: item.color || '',
            quantity: item.quantity,
            referenceId: orderNumber,
            actor: req.user,
            performedByType: 'SYSTEM',
          });
          if (!r.duplicate) deducted.push({ kind: 'product', product: item.product, size: item.size || '', color: item.color || '', quantity: item.quantity });
        } else if (item.combo) {
          await deductComboStock({
            comboId: item.combo,
            quantity: item.quantity,
            referenceId: orderNumber,
            actor: req.user,
            performedByType: 'SYSTEM',
          });
          deducted.push({ kind: 'combo', combo: item.combo, quantity: item.quantity });
        }
      }
    } catch (e) {
      if (e.code === 'INSUFFICIENT_STOCK') {
        if (idem) { idem.status = 'FAILED'; await idem.save().catch(() => {}); }
        return res.status(400).json({ success: false, message: e.message, code: 'INSUFFICIENT_STOCK' });
      }
      throw e;
    }

    let order;
    try {
      order = await Order.create({
      orderNumber,
      customer: req.user.id,
      orderItems,
      shippingAddress: {
        fullName: shippingAddress.fullName || req.user.name,
        phone: shippingAddress.phone || req.user.phone,
        address: shippingAddress.address,
        area: shippingAddress.area || deliveryArea.name,
        city: shippingAddress.city || 'Dhaka',
        deliveryArea: deliveryArea._id,
        latitude: shippingAddress.latitude,
        longitude: shippingAddress.longitude,
        placeId: shippingAddress.placeId,
        uCode: shippingAddress.uCode || '',
        zone: shippingAddress.zone || '',
      },
      deliveryArea: deliveryArea._id,
      deliverySlot: slotSnap,
      paymentMethod,
      paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Pending',
      orderStatus: 'Pending',
      subtotal,
      deliveryCharge: finalCharge,
      deliveryInfo: deliveryCalc
        ? {
            groceryCharge: deliveryCalc.groceryCharge,
            nationwideCharge: deliveryCalc.nationwideCharge,
            freeDelivery: deliveryCalc.freeDelivery,
            matchMethod: deliveryCalc.matchMethod || '',
          }
        : undefined,
      discount,
      couponCode: appliedCoupon,
      totalAmount: finalTotal,
      taxAmount,
      taxMode,
      taxRateSnap,
      taxNameSnap,
      paidAmount: 0,
      notes,
      statusHistory: [
        {
          status: 'Pending',
          changedBy: req.user.id,
          note: 'Order placed',
          timestamp: new Date(),
        },
      ],
    });
    } catch (e) {
      // Order failed to persist AFTER stock was deducted → put every line back.
      // Uses CANCEL keys (never collides with the SALE keys above).
      for (const d of deducted) {
        try {
          if (d.kind === 'product') {
            await returnStock({ productId: d.product, size: d.size, color: d.color, quantity: d.quantity, referenceId: orderNumber, actor: req.user, performedByType: 'SYSTEM' });
          } else {
            await returnComboStock({ comboId: d.combo, quantity: d.quantity, referenceId: orderNumber, actor: req.user, performedByType: 'SYSTEM' });
          }
        } catch (compErr) {
          console.error('checkout compensation failed:', compErr.message, { orderNumber });
        }
      }
      throw e;
    }

    // Stock deducted via Inventory Service before Order.create (compensated above on failure).

    // Update coupon usage (global count + per-user tracking for maxPerUser caps)
    if (appliedCoupon) {
      const bumped = await Coupon.findOneAndUpdate(
        { code: appliedCoupon, 'usedBy.user': req.user.id },
        { $inc: { usedCount: 1, 'usedBy.$.count': 1 } }
      );
      if (!bumped) {
        await Coupon.findOneAndUpdate(
          { code: appliedCoupon },
          { $inc: { usedCount: 1 }, $push: { usedBy: { user: req.user.id, count: 1 } } }
        );
      }
    }

    // Clear cart
    cart.items = [];
    await cart.save();

    // Populate response
    const populatedOrder = await Order.findById(order._id)
      .populate('customer', 'name email phone')
      .populate('deliveryArea', 'name deliveryCharge estimatedDeliveryTime')
      .populate('orderItems.product', 'name slug images')
      .populate('orderItems.combo', 'name slug images');

    // Fire-and-forget notifications
    notifyOrderPlaced(order, req.user).catch((e) => console.error('notifyOrderPlaced', e.message));

    if (idem) {
      idem.status = 'COMPLETED';
      idem.order = order._id;
      idem.orderNumber = order.orderNumber;
      await idem.save().catch(() => {});
    }
    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: populatedOrder,
    });
  } catch (error) {
    console.error(error);
    if (idem && idem.status === 'IN_PROGRESS') {
      idem.status = 'FAILED';
      await idem.save().catch(() => {});
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get logged in user's orders
// @route   GET /api/orders/my-orders
// @access  Private
export const getMyOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { customer: req.user.id };
    if (status) query.orderStatus = status;

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await Order.find(query)
      .populate('deliveryArea', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: orders,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single order (customer can only see own)
// @route   GET /api/orders/:id
// @access  Private
export const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('deliveryArea', 'name deliveryCharge estimatedDeliveryTime')
      .populate('assignedRider', 'name phone')
      .populate('orderItems.product', 'name slug images unit')
      .populate('orderItems.combo', 'name slug images')
      .populate('statusHistory.changedBy', 'name role');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Customer can only view own order
    const isOwner = order.customer._id.toString() === req.user.id;
    const isStaff = ['SUPER_ADMIN', 'SUB_ADMIN', 'ORDER_MANAGER', 'DELIVERY_MANAGER', 'DELIVERY_RIDER', 'ACCOUNTANT'].includes(req.user.role);

    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all orders (Admin)
// @route   GET /api/orders
// @access  Private (ORDER_VIEW)
export const getOrders = async (req, res) => {
  try {
    const {
      status,
      paymentStatus,
      paymentMethod,
      search,
      page = 1,
      limit = 20,
      sort = '-createdAt',
    } = req.query;

    const query = {};

    if (status) query.orderStatus = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (search) {
      const { escapeRegExp } = await import('../utils/safeRegex.js');
      const rx = { $regex: escapeRegExp(search), $options: 'i' };
      query.$or = [
        { orderNumber: rx },
        { 'shippingAddress.phone': rx },
        { 'shippingAddress.fullName': rx },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await Order.find(query)
      .populate('customer', 'name phone email')
      .populate('deliveryArea', 'name')
      .populate('assignedRider', 'name phone')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: orders,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private (ORDER_UPDATE)
export const updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;

    const allowedStatuses = [
      'Pending',
      'Confirmed',
      'Processing',
      'Ready for Delivery',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
    ];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required',
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Prevent changing delivered/cancelled orders easily
    if (['Delivered', 'Cancelled'].includes(order.orderStatus) && status !== order.orderStatus) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status of a ${order.orderStatus} order`,
      });
    }

    order.orderStatus = status;
    order.statusHistory.push({
      status,
      changedBy: req.user.id,
      note: note || `Status changed to ${status}`,
      timestamp: new Date(),
    });

    // If delivered + COD → mark payment as Paid
    if (status === 'Delivered' && order.paymentMethod === 'COD') {
      order.paymentStatus = 'Paid';
    }

    // If cancelled → release stock via Inventory Service (idempotent per order)
    if (status === 'Cancelled') {
      const { returnStock, returnComboStock } = await import('../services/inventory/stockService.js');
      for (const item of order.orderItems) {
        if (item.product) {
          await returnStock({
            productId: item.product,
            size: item.size || '',
            color: item.color || '',
            quantity: item.quantity,
            referenceId: order.orderNumber,
            actor: req.user,
            performedByType: 'SYSTEM',
          });
        } else if (item.combo) {
          await returnComboStock({
            comboId: item.combo,
            quantity: item.quantity,
            referenceId: order.orderNumber,
            actor: req.user,
            performedByType: 'SYSTEM',
          });
        }
      }
    }

    await order.save();

    // --- Accounting autopilot (best-effort; never breaks order flow) ---
    try {
      if (status === 'Confirmed') {
        await recordSale(order, { actorId: req.user.id, req });
      }
      if (status === 'Delivered' && order.paymentMethod === 'COD' && order.paymentStatus === 'Paid') {
        const remaining = Math.max(0, (order.totalAmount || 0) - (order.paidAmount || 0));
        if (remaining > 0) {
          await recordPayment(order, { amount: remaining, method: 'COD', actorId: req.user.id, note: 'COD collected on delivery', req });
        }
      }
      if (status === 'Cancelled' && (order.paidAmount || 0) > 0) {
        // Paid order cancelled → refund record; money-out decides Paid (gateway
        // refunds settle async — 'Refunded' is written only on actual money-out).
        const ret = await Return.create({
          order: order._id,
          type: 'SALE_RETURN',
          items: (order.orderItems || []).filter((i) => i.product).map((i) => ({
            product: i.product, name: i.name, quantity: i.quantity, price: i.price,
          })),
          refundAmount: order.paidAmount,
          reason: 'Order cancelled after payment',
          status: 'Refunded',
          refundStatus: 'Pending',
          refundMethod: order.paymentMethod === 'COD' ? 'Cash' : order.paymentMethod,
          createdBy: req.user.id,
        });
        let refundOutcome = 'pending';
        try {
          const { processRefund } = await import('../services/refundService.js');
          ({ outcome: refundOutcome } = await processRefund(ret, { actor: req.user }));
        } catch (e) {
          console.error('[refund]', e.message);
        }
        if (['paid', 'paid-zero', 'paid-cash'].includes(refundOutcome)) {
          await recordRefund({ order, amount: order.paidAmount, method: order.paymentMethod, reason: 'Order cancelled', actorId: req.user.id, req, returnRef: ret._id });
          ret.journalPosted = true;
          await ret.save({ validateBeforeSave: false });
          order.paymentStatus = 'Refunded';
          await order.save({ validateBeforeSave: false });
        } else {
          order.statusHistory.push({ status: 'Cancelled', changedBy: req.user.id, note: `Refund ${refundOutcome} — money pending`, timestamp: new Date() });
          await order.save({ validateBeforeSave: false });
        }
      }
    } catch (e) {
      console.error('[accounting autopilot]', e.message);
    }

    const updated = await Order.findById(order._id)
      .populate('customer', 'name phone')
      .populate('statusHistory.changedBy', 'name role');

    // Notify customer
    try {
      const User = (await import('../models/User.js')).default;
      const customer = await User.findById(order.customer).select('name email phone');
      notifyOrderStatus(order, customer, status).catch((e) =>
        console.error('notifyOrderStatus', e.message)
      );
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Decide a substitution proposal (Customer - owner only)
// @route   PATCH /api/orders/:id/substitute/:subId
// @access  Private
export const decideSubstitute = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const sub = (order.substitutions || []).id(req.params.subId);
    if (!sub || sub.status !== 'PROPOSED') {
      return res.status(400).json({ success: false, message: 'No pending proposal found' });
    }
    if (!['Pending', 'Confirmed', 'PLACED', 'CONFIRMED', 'PROCESSING', 'PENDING_VERIFICATION'].includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: `Too late — order is ${order.orderStatus}` });
    }
    if (req.body.approve !== true) {
      sub.status = 'REJECTED';
      sub.decidedAt = new Date();
      await order.save();
      return res.json({ success: true, data: order });
    }
    const line = (order.orderItems || []).id(sub.line);
    if (!line || line.quantity < sub.quantity) {
      return res.status(400).json({ success: false, message: 'Original line changed — ask support' });
    }
    const Product = (await import('../models/Product.js')).default;
    const replacement = await Product.findById(sub.substituteProduct);
    if (!replacement || !replacement.isActive) {
      return res.status(400).json({ success: false, message: 'Substitute no longer available' });
    }
    const { returnStock, deductStock, checkAvailable } = await import('../services/inventory/stockService.js');
    const avail = await checkAvailable({ productId: replacement._id, quantity: sub.quantity });
    if (!avail.sufficient) {
      return res.status(400).json({ success: false, message: `Substitute now has only ${avail.available} available`, code: 'INSUFFICIENT_STOCK' });
    }
    const newPrice = replacement.salePrice || replacement.regularPrice || 0;
    await returnStock({ productId: line.product, size: line.size || '', color: line.color || '', quantity: sub.quantity, referenceId: `${order.orderNumber}#sub`, actor: req.user, performedByType: 'SYSTEM' });
    await deductStock({ productId: replacement._id, quantity: sub.quantity, referenceId: `${order.orderNumber}#sub`, actor: req.user, performedByType: 'SYSTEM' });
    line.quantity -= sub.quantity;
    if (line.quantity <= 0) order.orderItems.pull(line._id);
    order.orderItems.push({ product: replacement._id, name: replacement.name, quantity: sub.quantity, price: newPrice, unit: replacement.unit, cost: replacement.costPrice || 0 });
    order.subtotal = Math.max(0, (order.subtotal || 0) - (line.price || 0) * sub.quantity + newPrice * sub.quantity);
    order.totalAmount = Math.max(0, (order.subtotal || 0) + (order.deliveryCharge || 0) - (order.discount || 0));
    sub.status = 'APPROVED';
    sub.decidedAt = new Date();
    order.statusHistory.push({ status: order.orderStatus, changedBy: req.user.id, note: `Substituted: ${line.name} × ${sub.quantity} → ${replacement.name}`, timestamp: new Date() });
    await order.save();
    // Books: net the swap (out-leg reverses, in-leg recognizes). Paid orders:
    // revenue stays (cash diff settles via refund/due flow), COGS always nets.
    try {
      const { recordSaleAdjustment } = await import('../services/accountingService.js');
      const paid = (order.paidAmount || 0) > 0;
      await recordSaleAdjustment({
        order,
        lineRef: `sub:${sub._id}`,
        revenueDelta: paid ? 0 : (newPrice - (line.price || 0)) * sub.quantity,
        cogsDelta: ((Number(line.cost) || 0) - (Number(replacement.costPrice) || 0)) * sub.quantity,
        reason: `Substitution ${line.name} → ${replacement.name}`,
        actorId: req.user.id, req,
      });
    } catch (e) {
      console.error('[sale-adjust]', e.message);
    }
    // Cash diff on PAID orders: overpay → auto-refund via refund machine;
    // underpay → due grows with total + customer notified (collect on delivery).
    const cashDiff = (newPrice - (line.price || 0)) * sub.quantity;
    if ((order.paidAmount || 0) > 0 && cashDiff !== 0) {
      try {
        if (cashDiff < 0) {
          const Return = (await import('../models/Return.js')).default;
          const ret = await Return.create({
            order: order._id, type: 'SALE_RETURN',
            items: [{ product: line.product || undefined, name: `${line.name} → ${replacement.name} (swap diff)`, quantity: sub.quantity, price: Math.abs(cashDiff) / sub.quantity }],
            refundAmount: Math.abs(cashDiff),
            reason: `Substitution overpay refund: ${line.name} → ${replacement.name}`,
            status: 'Refunded', refundStatus: 'Pending',
            refundMethod: order.paymentMethod === 'COD' ? 'Cash' : order.paymentMethod,
            createdBy: req.user.id,
          });
          const { processRefund } = await import('../services/refundService.js');
          const { outcome } = await processRefund(ret, { actor: req.user });
          if (['paid', 'paid-zero', 'paid-cash'].includes(outcome)) {
            const { recordRefund } = await import('../services/accountingService.js');
            await recordRefund({ order, amount: ret.refundAmount, method: order.paymentMethod, reason: 'Substitution overpay', actorId: req.user.id, req, returnRef: ret._id });
            ret.journalPosted = true;
            await ret.save({ validateBeforeSave: false });
          }
        }
        const phone = order.shippingAddress?.phone;
        if (phone) {
          const { sendSMS } = await import('../utils/notifications.js');
          await sendSMS({ to: phone, message: cashDiff < 0
            ? `[MadinaBazar] Swap accepted (${replacement.name}). Overpay ৳${Math.abs(cashDiff)} refund processing.`
            : `[MadinaBazar] Swap accepted (${replacement.name}). Extra ৳${cashDiff} due on delivery.` });
        }
      } catch (e) {
        console.error('[swap-cashdiff]', e.message);
      }
    }
    res.json({ success: true, data: order });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// @desc    Cancel order (Customer - only if Pending)
// @route   PATCH /api/orders/:id/cancel
// @access  Private
export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Only owner can cancel
    if (order.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (order.orderStatus !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending orders can be cancelled',
      });
    }

    order.orderStatus = 'Cancelled';
    order.statusHistory.push({
      status: 'Cancelled',
      changedBy: req.user.id,
      note: 'Cancelled by customer',
      timestamp: new Date(),
    });

    // Restore stock via Inventory Service (idempotent per order)
    const { returnStock: returnStockCancel, returnComboStock: returnComboCancel } = await import('../services/inventory/stockService.js');
    for (const item of order.orderItems) {
      if (item.product) {
        await returnStockCancel({
          productId: item.product,
          size: item.size || '',
          color: item.color || '',
          quantity: item.quantity,
          referenceId: order.orderNumber,
          actor: req.user,
          performedByType: 'SYSTEM',
        });
      } else if (item.combo) {
        await returnComboCancel({
          comboId: item.combo,
          quantity: item.quantity,
          referenceId: order.orderNumber,
          actor: req.user,
          performedByType: 'SYSTEM',
        });
      }
    }

    await order.save();

    // Paid + cancelled → auto refund record + reversal (best-effort)
    try {
      if ((order.paidAmount || 0) > 0) {
        const ret = await Return.create({
          order: order._id,
          type: 'SALE_RETURN',
          items: (order.orderItems || []).filter((i) => i.product).map((i) => ({
            product: i.product, name: i.name, quantity: i.quantity, price: i.price,
          })),
          refundAmount: order.paidAmount,
          reason: 'Order cancelled by customer after payment',
          status: 'Refunded',
          refundStatus: 'Pending',
          refundMethod: order.paymentMethod === 'COD' ? 'Cash' : order.paymentMethod,
          createdBy: req.user.id,
        });
        let refundOutcome = 'pending';
        try {
          const { processRefund } = await import('../services/refundService.js');
          ({ outcome: refundOutcome } = await processRefund(ret, { actor: req.user }));
        } catch (e) {
          console.error('[refund]', e.message);
        }
        if (['paid', 'paid-zero', 'paid-cash'].includes(refundOutcome)) {
          await recordRefund({ order, amount: order.paidAmount, method: order.paymentMethod, reason: 'Customer cancel', actorId: req.user.id, req, returnRef: ret._id });
          ret.journalPosted = true;
          await ret.save({ validateBeforeSave: false });
          order.paymentStatus = 'Refunded';
          await order.save({ validateBeforeSave: false });
        } else {
          order.statusHistory.push({ status: 'Cancelled', changedBy: req.user.id, note: `Refund ${refundOutcome} — money pending`, timestamp: new Date() });
          await order.save({ validateBeforeSave: false });
        }
      }
    } catch (e) {
      console.error('[accounting autopilot]', e.message);
    }

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Assign rider to order
// @route   PATCH /api/orders/:id/assign-rider
// @access  Private (ORDER_ASSIGN_RIDER)
export const assignRider = async (req, res) => {
  try {
    const { riderId } = req.body;

    if (!riderId) {
      return res.status(400).json({ success: false, message: 'Rider ID is required' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.assignedRider = riderId;
    order.statusHistory.push({
      status: order.orderStatus,
      changedBy: req.user.id,
      note: `Rider assigned`,
      timestamp: new Date(),
    });

    await order.save();

    const updated = await Order.findById(order._id)
      .populate('assignedRider', 'name phone')
      .populate('customer', 'name phone');

    res.status(200).json({
      success: true,
      message: 'Rider assigned successfully',
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Combo from '../models/Combo.js';
import DeliveryArea from '../models/DeliveryArea.js';
import { resolveGroceryZone } from './groceryZoneController.js';

// @desc    Validate cart lines for an address (the "Backend Availability Check")
// @route   POST /api/cart/validate
// @access  Public (works for guest carts too — pass items)
// body: { latitude, longitude, items?: [{ productId, comboId?, quantity }] }
//   - logged-in + no items → validates server cart (lineIds included)
//   - rules: grocery → must be inside active zone (when coords given);
//     others → nationwide; inactive / out-of-stock → unavailable always.
export const validateCart = async (req, res) => {
  try {
    const lat = Number(req.body.latitude);
    const lng = Number(req.body.longitude);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
    const placeId = req.body.placeId || '';
    const uCode = req.body.uCode || '';
    const hasLocation = Boolean(placeId || uCode || hasCoords);

    let zone = null;
    let matchMethod = null;
    if (hasLocation) {
      const resolved = await resolveGroceryZone({ placeId, uCode, lat, lng });
      if (resolved) {
        zone = resolved.zone;
        matchMethod = resolved.method;
      }
    }
    // Source lines: explicit (guest) or server cart (logged-in)
    let source = Array.isArray(req.body.items) ? req.body.items : null;
    let serverLines = null;
    if (!source && req.user) {
      const cart = await Cart.findOne({ user: req.user.id });
      serverLines = cart?.items || [];
      source = serverLines.map((i) => ({
        lineId: String(i._id),
        productId: i.product ? String(i.product) : undefined,
        comboId: i.combo ? String(i.combo) : undefined,
        quantity: i.quantity,
        size: i.size || '',
        color: i.color || '',
      }));
    }
    source = source || [];

    const groceryAreas = await DeliveryArea.find({ isActive: true, groceryDelivery: true })
      .select('name city')
      .sort({ name: 1 })
      .lean();

    const lines = [];
    for (const [idx, s] of source.entries()) {
      const qty = Math.max(1, Number(s.quantity) || 1);
      const base = {
        key: s.lineId || `${s.productId || s.comboId || idx}`,
        lineId: s.lineId || null,
        productId: s.productId || null,
        comboId: s.comboId || null,
        quantity: qty,
        size: s.size || '',
        color: s.color || '',
      };
      if (s.productId) {
        const p = await Product.findById(s.productId)
          .select('name images regularPrice salePrice stock isActive isGrocery productType')
          .lean();
        if (!p || !p.isActive) {
          lines.push({ ...base, name: p?.name || 'Product', available: false, reason: 'INACTIVE', message: 'No longer available' });
          continue;
        }
        if (p.stock < qty) {
          lines.push({ ...base, name: p.name, image: p.images?.[0]?.url || p.images?.[0] || null, price: p.salePrice || p.regularPrice, isGrocery: !!p.isGrocery, available: false, reason: 'OUT_OF_STOCK', message: `Only ${p.stock} in stock` });
          continue;
        }
        const grocery = !!p.isGrocery;
        if (grocery && hasLocation && !zone) {
          lines.push({ ...base, name: p.name, image: p.images?.[0]?.url || p.images?.[0] || null, price: p.salePrice || p.regularPrice, isGrocery: true, available: false, reason: 'OUT_OF_ZONE', message: 'Grocery delivery is not available at your selected address.' });
          continue;
        }
        lines.push({
          ...base, name: p.name, image: p.images?.[0]?.url || p.images?.[0] || null,
          price: p.salePrice || p.regularPrice, isGrocery: grocery, available: true,
          reason: grocery ? (zone ? 'IN_ZONE' : 'NO_COORDS') : 'NATIONWIDE',
        });
      } else if (s.comboId) {
        const c = await Combo.findById(s.comboId)
          .select('name images regularPrice salePrice isActive items')
          .populate('items.product', 'isGrocery')
          .lean();
        if (!c || !c.isActive) {
          lines.push({ ...base, name: c?.name || 'Combo', available: false, reason: 'INACTIVE', message: 'No longer available' });
          continue;
        }
        const grocery = (c.items || []).some((i) => i.product?.isGrocery);
        if (grocery && hasLocation && !zone) {
          lines.push({ ...base, name: c.name, image: c.images?.[0]?.url || c.images?.[0] || null, price: c.salePrice || c.regularPrice, isGrocery: true, available: false, reason: 'OUT_OF_ZONE', message: 'Grocery delivery is not available at your selected address.' });
          continue;
        }
        lines.push({
          ...base, name: c.name, image: c.images?.[0]?.url || c.images?.[0] || null,
          price: c.salePrice || c.regularPrice, isGrocery: grocery, available: true,
          reason: grocery ? (zone ? 'IN_ZONE' : 'NO_COORDS') : 'NATIONWIDE',
        });
      }
    }

    const unavailable = lines.filter((l) => !l.available);
    res.json({
      success: true,
      data: {
        hasCoords,
        hasLocation,
        matchMethod,
        zone: zone ? { _id: zone._id, name: zone.name, city: zone.city, district: zone.district || '', deliveryCharge: zone.deliveryCharge } : null,
        lines,
        unavailableCount: unavailable.length,
        groceryBlocked: lines.some((l) => !l.available && l.reason === 'OUT_OF_ZONE'),
        canPlaceOrder: unavailable.length === 0,
        groceryAreas: groceryAreas.map((a) => ({ _id: a._id, name: a.name, city: a.city })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
export const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product', 'name slug regularPrice salePrice unit images stock isActive productType isGrocery')
      .populate('items.combo', 'name slug regularPrice salePrice images isActive items');

    if (!cart) {
      cart = await Cart.create({ user: req.user.id, items: [] });
    }

    // Calculate totals
    let subtotal = 0;
    const validItems = [];

    for (const item of cart.items) {
      if (item.product) {
        if (!item.product.isActive) continue;
        const price = item.product.salePrice || item.product.regularPrice;
        subtotal += price * item.quantity;
        validItems.push(item);
      } else if (item.combo) {
        if (!item.combo.isActive) continue;
        const price = item.combo.salePrice || item.combo.regularPrice;
        subtotal += price * item.quantity;
        validItems.push(item);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        items: validItems,
        itemCount: validItems.reduce((acc, item) => acc + item.quantity, 0),
        subtotal: Math.round(subtotal),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add item to cart
// @route   POST /api/cart
// @access  Private
export const addToCart = async (req, res) => {
  try {
    const { productId, comboId, quantity = 1 } = req.body;
    const size = String(req.body.size || '').trim();
    const color = String(req.body.color || '').trim();
    const colorCode = String(req.body.colorCode || '').trim();

    if (!productId && !comboId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID or Combo ID is required',
      });
    }

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1',
      });
    }

    // Validate product or combo
    if (productId) {
      const product = await Product.findById(productId);
      if (!product || !product.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Product not found or unavailable',
        });
      }
      if (product.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} items available in stock`,
        });
      }
      // Validate variant against product's available options (if defined)
      if (product.sizes?.length && !product.sizes.includes(size)) {
        return res.status(400).json({
          success: false,
          message: `Please select a valid size: ${product.sizes.join(', ')}`,
        });
      }
      if (product.colors?.length && !product.colors.some((c) => c.name === color)) {
        return res.status(400).json({
          success: false,
          message: `Please select a valid color: ${product.colors.map((c) => c.name).join(', ')}`,
        });
      }
    }

    if (comboId) {
      const combo = await Combo.findById(comboId);
      if (!combo || !combo.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Combo not found or unavailable',
        });
      }
    }

    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      cart = await Cart.create({ user: req.user.id, items: [] });
    }

    // Check if item already exists (same product + same variant)
    const existingItemIndex = cart.items.findIndex((item) => {
      if (productId) {
        return (
          item.product &&
          item.product.toString() === productId &&
          (item.size || '') === size &&
          (item.color || '') === color
        );
      }
      if (comboId) {
        return item.combo && item.combo.toString() === comboId;
      }
      return false;
    });

    if (existingItemIndex > -1) {
      // Update quantity
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      const newItem = { quantity, size, color, colorCode };
      if (productId) newItem.product = productId;
      if (comboId) newItem.combo = comboId;
      cart.items.push(newItem);
    }

    await cart.save();

    // Populate and return
    const updatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name slug regularPrice salePrice unit images stock productType isGrocery')
      .populate('items.combo', 'name slug regularPrice salePrice images');

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: updatedCart,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/:itemId
// @access  Private
export const updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body;

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required',
      });
    }

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const item = cart.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    if (quantity === 0) {
      // Remove item
      cart.items.pull(req.params.itemId);
    } else {
      // Check stock if product
      if (item.product) {
        const product = await Product.findById(item.product);
        if (product && product.stock < quantity) {
          return res.status(400).json({
            success: false,
            message: `Only ${product.stock} items available in stock`,
          });
        }
      }
      item.quantity = quantity;
    }

    await cart.save();

    const updatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name slug regularPrice salePrice unit images stock productType isGrocery')
      .populate('items.combo', 'name slug regularPrice salePrice images');

    res.status(200).json({
      success: true,
      message: quantity === 0 ? 'Item removed from cart' : 'Cart updated',
      data: updatedCart,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/:itemId
// @access  Private
export const removeFromCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const item = cart.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    cart.items.pull(req.params.itemId);
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clear entire cart
// @route   DELETE /api/cart
// @access  Private
export const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

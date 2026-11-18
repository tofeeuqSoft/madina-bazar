import Wishlist from '../models/Wishlist.js';
import Product from '../models/Product.js';

// @desc    Get user wishlist
// @route   GET /api/wishlist
// @access  Private
export const getWishlist = async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user.id }).populate(
      'products',
      'name slug regularPrice salePrice unit images stock isActive'
    );

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user.id, products: [] });
    }

    // Filter only active products
    const activeProducts = wishlist.products.filter((p) => p && p.isActive);

    res.status(200).json({
      success: true,
      count: activeProducts.length,
      data: activeProducts,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add product to wishlist
// @route   POST /api/wishlist
// @access  Private
export const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required',
      });
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unavailable',
      });
    }

    let wishlist = await Wishlist.findOne({ user: req.user.id });

    if (!wishlist) {
      wishlist = await Wishlist.create({
        user: req.user.id,
        products: [productId],
      });
    } else {
      // Check if already exists
      if (wishlist.products.includes(productId)) {
        return res.status(400).json({
          success: false,
          message: 'Product already in wishlist',
        });
      }
      wishlist.products.push(productId);
      await wishlist.save();
    }

    const updated = await Wishlist.findById(wishlist._id).populate(
      'products',
      'name slug regularPrice salePrice unit images'
    );

    res.status(200).json({
      success: true,
      message: 'Product added to wishlist',
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove product from wishlist
// @route   DELETE /api/wishlist/:productId
// @access  Private
export const removeFromWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user.id });

    if (!wishlist) {
      return res.status(404).json({ success: false, message: 'Wishlist not found' });
    }

    const productId = req.params.productId;

    if (!wishlist.products.includes(productId)) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in wishlist',
      });
    }

    wishlist.products = wishlist.products.filter(
      (id) => id.toString() !== productId
    );
    await wishlist.save();

    res.status(200).json({
      success: true,
      message: 'Product removed from wishlist',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clear wishlist
// @route   DELETE /api/wishlist
// @access  Private
export const clearWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user.id });

    if (!wishlist) {
      return res.status(404).json({ success: false, message: 'Wishlist not found' });
    }

    wishlist.products = [];
    await wishlist.save();

    res.status(200).json({
      success: true,
      message: 'Wishlist cleared successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check if product is in wishlist
// @route   GET /api/wishlist/check/:productId
// @access  Private
export const checkInWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user.id });

    const isInWishlist = wishlist
      ? wishlist.products.some((id) => id.toString() === req.params.productId)
      : false;

    res.status(200).json({
      success: true,
      isInWishlist,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

import Review from '../models/Review.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import mongoose from 'mongoose';

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

// Recalculate product average + count (APPROVED reviews only)
const refreshProductRating = async (productId) => {
  const agg = await Review.aggregate([
    { $match: { product: toObjectId(productId), status: 'APPROVED' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Product.findByIdAndUpdate(productId, {
    ratingAvg: agg[0] ? +agg[0].avg.toFixed(1) : 0,
    ratingCount: agg[0] ? agg[0].count : 0,
  });
};

// @desc    Reviews of a product (summary + list)
// @route   GET /api/reviews/product/:productId
// @access  Public
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const product = await Product.findById(productId).select('ratingAvg ratingCount');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Storefront shows APPROVED only; staff see everything (?all=1 with permission)
    const showAll = req.query.all === '1' && req.user && req.user.role !== 'CUSTOMER';
    const visible = showAll ? { product: productId } : { product: productId, status: 'APPROVED' };
    const [list, total, dist] = await Promise.all([
      // Highest rated first, newest first within same rating
      Review.find(visible)
        .populate('user', 'name avatar')
        .sort({ rating: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Review.countDocuments(visible),
      Review.aggregate([
        { $match: { product: toObjectId(productId) } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
      ]),
    ]);

    // Own review (if logged in — optional auth)
    let mine = null;
    if (req.user) {
      mine = await Review.findOne({ product: productId, user: req.user.id });
    }

    res.json({
      success: true,
      data: {
        summary: { avg: product.ratingAvg || 0, count: product.ratingCount || 0, distribution: dist },
        list,
        mine,
      },
      meta: { page: Number(page), pages: Math.ceil(total / Number(limit)), total },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add or update own review
// @route   POST /api/reviews
// @access  Private
export const upsertReview = async (req, res) => {
  try {
    const { productId, rating, comment = '' } = req.body;
    const stars = Number(rating);

    if (!productId || !stars || stars < 1 || stars > 5) {
      return res.status(400).json({ success: false, message: 'Product and rating (1–5) are required' });
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Verified purchase: delivered (or any non-cancelled) order with this product
    const bought = await Order.exists({
      customer: req.user.id,
      orderStatus: { $ne: 'Cancelled' },
      'orderItems.product': product._id,
    });

    // New reviews enter moderation (PENDING); edits keep existing status
    const review = await Review.findOneAndUpdate(
      { product: productId, user: req.user.id },
      {
        rating: stars,
        comment: String(comment).slice(0, 1000),
        verifiedPurchase: Boolean(bought),
        $setOnInsert: { status: 'PENDING' },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    await refreshProductRating(productId);

    res.status(200).json({
      success: true,
      message: review.status === 'PENDING' ? 'Review submitted for moderation' : 'Review updated',
      data: review,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Moderate review (staff only)
// @route   PATCH /api/reviews/:id/status
// @access  Private (staff)
export const moderateReview = async (req, res) => {
  try {
    if (req.user.role === 'CUSTOMER') {
      return res.status(403).json({ success: false, message: 'Staff only' });
    }
    const { status } = req.body;
    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const review = await Review.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    await refreshProductRating(review.product);
    res.json({ success: true, data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete own review (staff can delete any)
// @route   DELETE /api/reviews/:id
// @access  Private
export const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    const isOwner = review.user.toString() === req.user.id;
    const isStaff = req.user.role !== 'CUSTOMER';
    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const pid = review.product;
    await review.deleteOne();
    await refreshProductRating(pid);

    res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/authMiddleware.js';
import { getProductReviews, upsertReview, deleteReview, moderateReview } from '../controllers/reviewController.js';

const router = express.Router();

// Optional auth — attaches req.user when a valid token is present,
// otherwise continues as guest (for "mine" review lookup)
const optionalAuth = async (req, _res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (user?.isActive) req.user = user;
    }
  } catch (_) {}
  next();
};

router.get('/product/:productId', optionalAuth, getProductReviews);
router.post('/', protect, upsertReview);
router.patch('/:id/status', protect, moderateReview);
router.delete('/:id', protect, deleteReview);

export default router;

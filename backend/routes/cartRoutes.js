import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  validateCart,
} from '../controllers/cartController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Optional auth — guests can validate too (their items are passed explicitly)
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

// Availability check must come before protect + '/:itemId' routes
router.post('/validate', optionalAuth, validateCart);

// All cart routes below require login
router.use(protect);

router
  .route('/')
  .get(getCart)
  .post(addToCart)
  .delete(clearCart);

router
  .route('/:itemId')
  .put(updateCartItem)
  .delete(removeFromCart);

export default router;

import express from 'express';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  checkInWishlist,
} from '../controllers/wishlistController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All wishlist routes require login
router.use(protect);

router
  .route('/')
  .get(getWishlist)
  .post(addToWishlist)
  .delete(clearWishlist);

router.get('/check/:productId', checkInWishlist);
router.delete('/:productId', removeFromWishlist);

export default router;

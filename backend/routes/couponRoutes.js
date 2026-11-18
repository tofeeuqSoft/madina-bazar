import express from 'express';
import {
  getCoupons,
  getCoupon,
  validateCoupon,
  createCoupon,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
} from '../controllers/couponController.js';
import { protect, checkPermission } from '../middleware/authMiddleware.js';

const router = express.Router();

// Validate coupon (logged in customer)
router.post('/validate', protect, validateCoupon);

// Admin routes
router.get(
  '/',
  protect,
  checkPermission('COUPON_VIEW'),
  getCoupons
);

router.get(
  '/:id',
  protect,
  checkPermission('COUPON_VIEW'),
  getCoupon
);

router.post(
  '/',
  protect,
  checkPermission('COUPON_CREATE'),
  createCoupon
);

router.put(
  '/:id',
  protect,
  checkPermission('COUPON_UPDATE'),
  updateCoupon
);

router.patch(
  '/:id/status',
  protect,
  checkPermission('COUPON_UPDATE'),
  toggleCouponStatus
);

router.delete(
  '/:id',
  protect,
  checkPermission('COUPON_DELETE'),
  deleteCoupon
);

export default router;

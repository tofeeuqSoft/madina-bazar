import express from 'express';
import {
  initiatePayment,
  updatePaymentStatus,
  reconcilePayments,
  bkashCallback,
  nagadCallback,
  getGateways,
  sslcommerzSuccess,
  sslcommerzFail,
  sslcommerzCancel,
  sslcommerzIpn,
} from '../controllers/paymentController.js';
import { protect, checkPermission } from '../middleware/authMiddleware.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public
router.get('/gateways', getGateways);
router.get('/bkash/callback', bkashCallback);
router.get('/nagad/callback', nagadCallback);

// SSLCommerz (POST from gateway)
router.post('/sslcommerz/success', sslcommerzSuccess);
router.post('/sslcommerz/fail', sslcommerzFail);
router.post('/sslcommerz/cancel', sslcommerzCancel);
router.post('/sslcommerz/ipn', sslcommerzIpn);
// Also allow GET for some environments
router.get('/sslcommerz/success', sslcommerzSuccess);
router.get('/sslcommerz/fail', sslcommerzFail);
router.get('/sslcommerz/cancel', sslcommerzCancel);

// Customer
router.post('/initiate', protect, paymentLimiter, initiatePayment);

// Admin
router.patch(
  '/:orderId/status',
  protect,
  checkPermission('PAYMENT_VIEW', 'ORDER_UPDATE'),
  updatePaymentStatus
);
router.post(
  '/reconcile',
  protect,
  checkPermission('PAYMENT_VIEW', 'ORDER_UPDATE'),
  reconcilePayments
);

export default router;

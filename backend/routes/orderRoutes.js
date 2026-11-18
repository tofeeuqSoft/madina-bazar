import express from 'express';
import {
  createOrder,
  getMyOrders,
  getOrder,
  getOrders,
  updateOrderStatus,
  cancelOrder,
  decideSubstitute,
  assignRider,
} from '../controllers/orderController.js';
import { protect, checkPermission, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Customer routes
router.post('/', createOrder);
router.get('/my-orders', getMyOrders);
router.patch('/:id/cancel', cancelOrder);
router.patch('/:id/substitute/:subId', decideSubstitute);

// Admin / Staff routes
router.get(
  '/',
  checkPermission('ORDER_VIEW'),
  getOrders
);

router.get('/:id', getOrder); // owner or staff

router.patch(
  '/:id/status',
  checkPermission('ORDER_UPDATE'),
  updateOrderStatus
);

router.patch(
  '/:id/assign-rider',
  checkPermission('ORDER_ASSIGN_RIDER'),
  assignRider
);

export default router;

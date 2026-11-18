import express from 'express';
import {
  notificationStatus,
  testNotification,
} from '../controllers/notificationController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/status', notificationStatus);
router.post(
  '/test',
  protect,
  authorize('SUPER_ADMIN', 'SUB_ADMIN'),
  testNotification
);

export default router;

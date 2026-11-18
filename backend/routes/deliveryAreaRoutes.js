import express from 'express';
import {
  getDeliveryAreas,
  getActiveDeliveryAreas,
  getDeliveryArea,
  createDeliveryArea,
  updateDeliveryArea,
  toggleDeliveryAreaStatus,
  deleteDeliveryArea,
  checkDeliveryAvailability,
} from '../controllers/deliveryAreaController.js';
import { protect, checkPermission, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public
router.get('/', getDeliveryAreas);
router.get('/active', getActiveDeliveryAreas);
router.post('/check', checkDeliveryAvailability);
router.get('/:id', getDeliveryArea);

// Protected
router.post(
  '/',
  protect,
  checkPermission('DELIVERY_AREA_CREATE'),
  createDeliveryArea
);

router.put(
  '/:id',
  protect,
  checkPermission('DELIVERY_AREA_UPDATE'),
  updateDeliveryArea
);

router.patch(
  '/:id/status',
  protect,
  checkPermission('DELIVERY_AREA_DISABLE', 'DELIVERY_AREA_UPDATE'),
  toggleDeliveryAreaStatus
);

router.delete(
  '/:id',
  protect,
  authorize('SUPER_ADMIN'),
  deleteDeliveryArea
);

export default router;

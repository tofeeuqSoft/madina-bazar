import express from 'express';
import { protect, checkPermission } from '../middleware/authMiddleware.js';
import {
  calculate,
  listSlots,
  getPublicFreeDelivery,
  getNationwide,
  upsertNationwide,
  deleteNationwide,
  getFreeDelivery,
  updateFreeDelivery,
  getShipmentRule,
  getDeliveryAnalytics,
  getAuditLog,
} from '../controllers/deliveryController.js';

const router = express.Router();

// Customer / checkout
router.post('/calculate', calculate);
router.get('/slots', listSlots);
router.get('/free-delivery', getPublicFreeDelivery);

// Analytics + audit (staff view+)
router.get('/analytics/overview', protect, checkPermission('REPORT_VIEW', 'DELIVERY_AREA_VIEW'), getDeliveryAnalytics);
router.get('/audit', protect, checkPermission('REPORT_VIEW', 'DELIVERY_AREA_VIEW'), getAuditLog);

// Admin (delivery permission family)
router.get('/nationwide', protect, checkPermission('DELIVERY_AREA_VIEW'), getNationwide);
router.post('/nationwide', protect, checkPermission('DELIVERY_AREA_CREATE'), upsertNationwide);
router.delete('/nationwide/:id', protect, checkPermission('DELIVERY_AREA_UPDATE'), deleteNationwide);
router.get('/free-delivery/admin', protect, checkPermission('DELIVERY_AREA_VIEW'), getFreeDelivery);
router.put('/free-delivery', protect, checkPermission('DELIVERY_AREA_UPDATE'), updateFreeDelivery);
router.get('/shipment-rule', protect, checkPermission('DELIVERY_AREA_VIEW'), getShipmentRule);

export default router;

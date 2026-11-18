import express from 'express';
import { protect, checkPermission } from '../middleware/authMiddleware.js';
import {
  checkGroceryZone,
  getActiveZones,
  getZones,
  createZone,
  updateZone,
  toggleZoneStatus,
  deleteZone,
} from '../controllers/groceryZoneController.js';

const router = express.Router();

// Public — MongoDB geo check, no Barikoi call
router.post('/check', checkGroceryZone);
router.get('/active', getActiveZones);

// Admin (reuse delivery-area permissions)
router.get('/', protect, checkPermission('DELIVERY_AREA_VIEW'), getZones);
router.post('/', protect, checkPermission('DELIVERY_AREA_CREATE'), createZone);
router.put('/:id', protect, checkPermission('DELIVERY_AREA_UPDATE'), updateZone);
router.patch('/:id/status', protect, checkPermission('DELIVERY_AREA_UPDATE'), toggleZoneStatus);
router.delete('/:id', protect, checkPermission('DELIVERY_AREA_UPDATE'), deleteZone);

export default router;

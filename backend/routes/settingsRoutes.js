import express from 'express';
import {
  getSettings,
  getAdminSettings,
  updateSettings,
} from '../controllers/settingsController.js';
import { protect, checkPermission, superAdminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public settings
router.get('/', getSettings);

// Admin
router.get(
  '/admin',
  protect,
  checkPermission('SETTINGS_VIEW'),
  getAdminSettings
);

router.put(
  '/',
  protect,
  checkPermission('SETTINGS_UPDATE'),
  updateSettings
);

export default router;

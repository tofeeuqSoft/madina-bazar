import express from 'express';
import {
  getCombos,
  getCombo,
  createCombo,
  updateCombo,
  toggleComboStatus,
  deleteCombo,
} from '../controllers/comboController.js';
import { protect, checkPermission } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public
router.get('/', getCombos);
router.get('/:id', getCombo);

// Protected
router.post(
  '/',
  protect,
  checkPermission('COMBO_CREATE'),
  createCombo
);

router.put(
  '/:id',
  protect,
  checkPermission('COMBO_UPDATE'),
  updateCombo
);

router.patch(
  '/:id/status',
  protect,
  checkPermission('COMBO_UPDATE'),
  toggleComboStatus
);

router.delete(
  '/:id',
  protect,
  checkPermission('COMBO_DELETE'),
  deleteCombo
);

export default router;

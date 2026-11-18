import express from 'express';
import {
  getCategories,
  getCategoryTree,
  getCategory,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
} from '../controllers/categoryController.js';
import { protect, checkPermission, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getCategories);
router.get('/tree', getCategoryTree);
router.get('/:id', getCategory);

// Protected routes
router.post(
  '/',
  protect,
  checkPermission('CATEGORY_CREATE'),
  createCategory
);

router.put(
  '/:id',
  protect,
  checkPermission('CATEGORY_UPDATE'),
  updateCategory
);

router.patch(
  '/:id/status',
  protect,
  checkPermission('CATEGORY_UPDATE'),
  toggleCategoryStatus
);

router.delete(
  '/:id',
  protect,
  checkPermission('CATEGORY_DELETE'),
  deleteCategory
);

export default router;

import express from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  updateStock,
  toggleProductStatus,
  getLowStockProducts,
  deleteProduct,
} from '../controllers/productController.js';
import { protect, checkPermission } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public
router.get('/', getProducts);

// Low stock - MUST be before /:id
router.get(
  '/inventory/low-stock',
  protect,
  checkPermission('INVENTORY_VIEW', 'PRODUCT_VIEW'),
  getLowStockProducts
);

router.get('/:id', getProduct);

// Protected - Create
router.post(
  '/',
  protect,
  checkPermission('PRODUCT_CREATE'),
  createProduct
);

// Protected - Update
router.put(
  '/:id',
  protect,
  checkPermission('PRODUCT_UPDATE'),
  updateProduct
);

router.patch(
  '/:id/stock',
  protect,
  checkPermission('INVENTORY_UPDATE', 'PRODUCT_UPDATE'),
  updateStock
);

router.patch(
  '/:id/status',
  protect,
  checkPermission('PRODUCT_STATUS', 'PRODUCT_UPDATE'),
  toggleProductStatus
);

router.delete(
  '/:id',
  protect,
  checkPermission('PRODUCT_DELETE'),
  deleteProduct
);

export default router;

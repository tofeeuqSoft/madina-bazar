import express from 'express';
import {
  uploadSingle,
  uploadMultiple,
  uploadStatus,
  deleteCloudinaryAsset,
} from '../controllers/uploadController.js';
import { upload } from '../utils/upload.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
const staff = authorize(
  'SUPER_ADMIN',
  'SUB_ADMIN',
  'INVENTORY_MANAGER',
  'ORDER_MANAGER'
);

router.get('/status', uploadStatus);
router.delete('/cloudinary', protect, staff, deleteCloudinaryAsset);

// Customer avatar — any logged-in user (field name: "avatar")
router.post('/avatar', protect, uploadLimiter, upload.single('avatar'), uploadSingle);

// Single: image or video — field name "file" or "image"
router.post('/', protect, staff, uploadLimiter, upload.single('file'), uploadSingle);
router.post('/image', protect, staff, uploadLimiter, upload.single('image'), uploadSingle);
router.post('/video', protect, staff, uploadLimiter, upload.single('video'), uploadSingle);

// Multiple mixed media — field "files" or "images"
router.post(
  '/multiple',
  protect,
  staff,
  uploadLimiter,
  upload.array('files', 12),
  uploadMultiple
);
router.post(
  '/multiple/images',
  protect,
  staff,
  uploadLimiter,
  upload.array('images', 12),
  uploadMultiple
);

export default router;

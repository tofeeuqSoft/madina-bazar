import express from 'express';
import {
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getAllPermissions,
} from '../controllers/roleController.js';
import { protect, authorize, superAdminOnly, checkPermission } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get all available permissions
router.get('/permissions/list', authorize('SUPER_ADMIN'), getAllPermissions);

// Role CRUD
router
  .route('/')
  .get(authorize('SUPER_ADMIN', 'SUB_ADMIN'), getRoles)
  .post(superAdminOnly, createRole);

router
  .route('/:id')
  .get(authorize('SUPER_ADMIN', 'SUB_ADMIN'), getRole)
  .put(superAdminOnly, updateRole)
  .delete(superAdminOnly, deleteRole);

export default router;

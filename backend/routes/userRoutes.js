import express from 'express';
import {
  getUsers,
  getUser,
  createStaff,
  updateUser,
  updateUserPermissions,
  toggleUserStatus,
  deleteUser,
} from '../controllers/userController.js';
import {
  protect,
  authorize,
  superAdminOnly,
  checkPermission,
} from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require login
router.use(protect);

// Get all users
router.get('/', authorize('SUPER_ADMIN', 'SUB_ADMIN'), getUsers);

// Create staff
router.post('/staff', superAdminOnly, createStaff);

// Single user
router
  .route('/:id')
  .get(authorize('SUPER_ADMIN', 'SUB_ADMIN'), getUser)
  .put(superAdminOnly, updateUser)
  .delete(superAdminOnly, deleteUser);

// Update only permissions (Sub Admin)
router.put('/:id/permissions', superAdminOnly, updateUserPermissions);

// Enable / Disable
router.patch('/:id/status', superAdminOnly, toggleUserStatus);

export default router;

import express from 'express';
import { protect, checkPermission } from '../middleware/authMiddleware.js';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../controllers/supplierController.js';

const router = express.Router();
router.use(protect);
router.get('/', checkPermission('REPORT_VIEW', 'USER_VIEW'), getSuppliers);
router.post('/', checkPermission('USER_CREATE', 'REPORT_SALES'), createSupplier);
router.put('/:id', checkPermission('USER_UPDATE', 'REPORT_SALES'), updateSupplier);
router.delete('/:id', checkPermission('USER_DISABLE', 'REPORT_SALES'), deleteSupplier);
export default router;

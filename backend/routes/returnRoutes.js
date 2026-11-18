import express from 'express';
import { protect, checkPermission } from '../middleware/authMiddleware.js';
import { getReturns, createReturn, updateReturnStatus, deleteReturn, requestReturn, retryRefund } from '../controllers/returnController.js';

const router = express.Router();
router.use(protect);
// Customer self-service (ownership enforced in controller)
router.post('/request', requestReturn);
router.get('/', checkPermission('REPORT_VIEW', 'ORDER_VIEW'), getReturns);
router.post('/', checkPermission('ORDER_UPDATE', 'REPORT_SALES'), createReturn);
router.patch('/:id/status', checkPermission('ORDER_UPDATE', 'REPORT_SALES'), updateReturnStatus);
router.post('/:id/refund', checkPermission('ORDER_UPDATE', 'REPORT_SALES'), retryRefund);
router.delete('/:id', checkPermission('ORDER_UPDATE'), deleteReturn);
export default router;

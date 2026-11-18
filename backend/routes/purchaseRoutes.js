import express from 'express';
import { protect, checkPermission } from '../middleware/authMiddleware.js';
import { getPurchases, createPurchase, updatePurchasePayment, deletePurchase } from '../controllers/purchaseController.js';

const router = express.Router();
router.use(protect);
router.get('/', checkPermission('REPORT_VIEW', 'REPORT_SALES'), getPurchases);
router.post('/', checkPermission('REPORT_SALES', 'INVENTORY_UPDATE'), createPurchase);
router.patch('/:id/payment', checkPermission('REPORT_SALES', 'PAYMENT_VIEW'), updatePurchasePayment);
router.delete('/:id', checkPermission('REPORT_SALES'), deletePurchase);
export default router;

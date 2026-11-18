import express from 'express';
import { getInvoice, printInvoice } from '../controllers/invoiceController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);
router.get('/:orderId', getInvoice);
router.get('/:orderId/print', printInvoice);
export default router;

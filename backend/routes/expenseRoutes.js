import express from 'express';
import { protect, checkPermission } from '../middleware/authMiddleware.js';
import { getExpenses, createExpense, updateExpense, deleteExpense, voidExpense } from '../controllers/expenseController.js';

const router = express.Router();
router.use(protect);
router.get('/', checkPermission('REPORT_VIEW', 'REPORT_SALES'), getExpenses);
router.post('/', checkPermission('REPORT_SALES', 'SETTINGS_UPDATE'), createExpense);
router.put('/:id', checkPermission('REPORT_SALES', 'SETTINGS_UPDATE'), updateExpense);
router.patch('/:id/void', checkPermission('REPORT_SALES', 'SETTINGS_UPDATE'), voidExpense);
router.delete('/:id', checkPermission('REPORT_SALES'), deleteExpense); // always 403 — void instead
export default router;

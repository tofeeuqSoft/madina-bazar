import express from 'express';
import { protect, checkPermission } from '../middleware/authMiddleware.js';
import {
  salesReport,
  purchaseReport,
  expenseReport,
  profitLossReport,
  balanceSheetReport,
  cashFlowReport,
  customerDueReport,
  supplierDueReport,
  paymentReport,
  refundReport,
  returnReport,
  taxReport,
  inventoryValuationReport,
  cogsReport,
  grossProfitReport,
  netProfitReport,
  summaryReport,
} from '../controllers/reportController.js';

const router = express.Router();
router.use(protect);

// Hub summary (dashboard cards)
router.get('/summary', checkPermission('REPORT_VIEW', 'REPORT_SALES'), summaryReport);

// Sales / inventory family
router.get('/sales', checkPermission('REPORT_VIEW', 'REPORT_SALES'), salesReport);
router.get('/inventory-valuation', checkPermission('REPORT_VIEW', 'REPORT_INVENTORY'), inventoryValuationReport);
router.get('/cogs', checkPermission('REPORT_VIEW', 'REPORT_SALES'), cogsReport);
router.get('/gross-profit', checkPermission('REPORT_VIEW', 'REPORT_SALES'), grossProfitReport);

// Purchase / expense
router.get('/purchases', checkPermission('REPORT_VIEW', 'REPORT_SALES'), purchaseReport);
router.get('/expenses', checkPermission('REPORT_VIEW', 'REPORT_SALES'), expenseReport);

// Profit family
router.get('/profit-loss', checkPermission('REPORT_VIEW', 'REPORT_SALES'), profitLossReport);
router.get('/net-profit', checkPermission('REPORT_VIEW', 'REPORT_SALES'), netProfitReport);

// Statements
router.get('/balance-sheet', checkPermission('REPORT_VIEW', 'REPORT_SALES'), balanceSheetReport);
router.get('/cash-flow', checkPermission('REPORT_VIEW', 'REPORT_SALES'), cashFlowReport);

// Dues
router.get('/customer-due', checkPermission('REPORT_VIEW', 'REPORT_SALES'), customerDueReport);
router.get('/supplier-due', checkPermission('REPORT_VIEW', 'REPORT_SALES'), supplierDueReport);

// Payments / refunds / returns / tax
router.get('/payments', checkPermission('REPORT_VIEW', 'PAYMENT_REPORT'), paymentReport);
router.get('/refunds', checkPermission('REPORT_VIEW', 'REPORT_SALES'), refundReport);
router.get('/returns', checkPermission('REPORT_VIEW', 'REPORT_SALES'), returnReport);
router.get('/tax', checkPermission('REPORT_VIEW', 'REPORT_SALES'), taxReport);

export default router;

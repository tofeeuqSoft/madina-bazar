import express from 'express';
import { protect, checkPermission } from '../middleware/authMiddleware.js';
import {
  getDashboard,
  getSales,
  getPayments,
  createPayment,
  verifyPayment,
  failPayment,
  getLedger,
  getJournals,
  voidJournalEntry,
  getTrialBalance,
  getProfitLoss,
  getCashFlow,
  getTaxReport,
  getCustomers,
  getCustomerAccount,
  getSupplierAccount,
  getAccounts,
  createAccount,
  updateAccount,
  transferFunds,
  getAccountTxns,
  getDeliveryAccounting,
  getAccSettings,
  updateAccSettings,
  repairPostings,
} from '../controllers/accountingController.js';

const router = express.Router();
router.use(protect);

const VIEW = checkPermission('ACCOUNTING_VIEW');
const MANAGE = checkPermission('ACCOUNTING_MANAGE');

// Dashboard & statements
router.get('/dashboard', VIEW, getDashboard);
router.get('/sales', VIEW, getSales);
router.get('/profit-loss', VIEW, getProfitLoss);
router.get('/cash-flow', VIEW, getCashFlow);
router.get('/tax', VIEW, getTaxReport);
router.get('/trial-balance', VIEW, getTrialBalance);
router.get('/delivery', VIEW, getDeliveryAccounting);

// Payments
router.get('/payments', VIEW, getPayments);
router.post('/payments', MANAGE, createPayment);
router.patch('/payments/:id/verify', MANAGE, verifyPayment);
router.patch('/payments/:id/fail', MANAGE, failPayment);

// Ledger & journals
router.get('/ledger', VIEW, getLedger);
router.get('/journals', VIEW, getJournals);
router.patch('/journals/:id/void', MANAGE, voidJournalEntry);

// Customers & suppliers
router.get('/customers', VIEW, getCustomers);
router.get('/customers/:id', VIEW, getCustomerAccount);
router.get('/suppliers/:id', VIEW, getSupplierAccount);

// Cash & bank
router.get('/accounts', VIEW, getAccounts);
router.post('/accounts', MANAGE, createAccount);
router.put('/accounts/:id', MANAGE, updateAccount);
router.post('/transfer', MANAGE, transferFunds);
router.get('/accounts/:code/txns', VIEW, getAccountTxns);

// Settings & repair
router.get('/settings', VIEW, getAccSettings);
router.put('/settings', MANAGE, updateAccSettings);
router.post('/repair', MANAGE, repairPostings);

export default router;

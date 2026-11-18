import express from 'express';
import { protect, checkPermission } from '../middleware/authMiddleware.js';
import * as c from '../controllers/marketingController.js';

const router = express.Router();
router.use(protect);

// Read-only marketing analytics (no business logic, no writes)
router.get('/dashboard', checkPermission('marketing.view', 'marketing.report.view'), c.getDashboard);
router.get('/sales', checkPermission('marketing.view', 'marketing.report.view'), c.getSales);
router.get('/products', checkPermission('marketing.view', 'marketing.report.view'), c.getProducts);
router.get('/rfm', checkPermission('marketing.view', 'marketing.report.view'), c.getRfm);
router.get('/geo', checkPermission('marketing.view', 'marketing.report.view'), c.getGeo);
router.get('/coupons', checkPermission('marketing.view', 'marketing.report.view'), c.getCoupons);
router.get('/retention', checkPermission('marketing.view', 'marketing.report.view'), c.getRetention);
router.get('/growth', checkPermission('marketing.view', 'marketing.report.view'), c.getGrowth);
router.get('/quality', checkPermission('marketing.view', 'marketing.report.view'), c.getQuality);
router.get('/rfm/export', checkPermission('marketing.export'), c.exportRfm);

export default router;

import express from 'express';
import { protect, checkPermission } from '../middleware/authMiddleware.js';
import * as c from '../controllers/orderAdminController.js';

const router = express.Router();
router.use(protect);

// JWT -> permission -> validation -> controller -> service -> DB
router.get('/dashboard', checkPermission('ORDER_VIEW', 'order.report.view'), c.getDashboard);
router.get('/reports', checkPermission('order.report.view', 'ORDER_VIEW'), c.getReports);
router.get('/export', checkPermission('order.report.export'), c.exportCsv);
router.get('/audit-logs', checkPermission('order.audit.view'), c.getAuditLogs);
router.get('/agents', checkPermission('order.assign', 'ORDER_ASSIGN_RIDER', 'ORDER_VIEW'), c.getAgents);

router.get('/', checkPermission('ORDER_VIEW', 'order.search'), c.listOrders);
router.get('/status/:status', checkPermission('ORDER_VIEW', 'order.filter'), c.listOrders);
router.get('/:id', checkPermission('ORDER_VIEW', 'order.search'), c.getOrderDetail);

router.patch('/:id/status', checkPermission('ORDER_UPDATE', 'order.status.update'), c.updateStatus);
router.patch('/:id/priority', checkPermission('order.priority.update', 'ORDER_UPDATE'), c.updatePriority);
router.patch('/:id/customer', checkPermission('order.customer.edit', 'ORDER_UPDATE'), c.updateCustomer);
router.patch('/:id/address', checkPermission('order.address.edit', 'ORDER_UPDATE'), c.updateAddress);

router.post('/:id/assign', checkPermission('order.assign', 'ORDER_ASSIGN_RIDER'), c.assign);
router.delete('/:id/assign', checkPermission('order.unassign', 'ORDER_ASSIGN_RIDER'), c.unassign);

router.post('/:id/hold', checkPermission('order.hold', 'ORDER_UPDATE'), c.hold);
router.post('/:id/cancel', checkPermission('order.cancel', 'ORDER_CANCEL'), c.cancel);
router.post('/:id/cancel-item', checkPermission('order.cancel', 'ORDER_CANCEL'), c.cancelItem);
router.post('/:id/substitute', checkPermission('ORDER_UPDATE', 'order.cancel'), c.proposeSubstitute);
router.post('/bulk', checkPermission('ORDER_VIEW', 'ORDER_UPDATE', 'order.assign'), c.bulk);
router.post('/:id/reopen', checkPermission('order.reopen', 'ORDER_UPDATE'), c.reopen);
router.post('/:id/refund-request', checkPermission('order.refund.request'), c.refundRequest);

router.get('/:id/notes', checkPermission('order.note.view', 'ORDER_VIEW'), c.getNotes);
router.post('/:id/notes', checkPermission('order.note.create'), c.addNote);
router.get('/:id/timeline', checkPermission('ORDER_VIEW', 'order.audit.view'), c.getTimeline);
router.post('/:id/communication', checkPermission('order.communication.send'), c.sendCommunication);

export default router;

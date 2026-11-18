import express from 'express';
import { protect, checkPermission } from '../middleware/authMiddleware.js';
import * as c from '../controllers/inventoryController.js';

const router = express.Router();
router.use(protect);

const V = 'inventory.view';
router.get('/dashboard', checkPermission('inventory.view', 'inventory.report.view'), c.getDashboard);

// Stock
router.get('/stock/counts', checkPermission('inventory.stock.view', V), c.getStockCounts);
router.post('/reconcile', checkPermission('inventory.settings.update'), c.runReconcile);
router.post('/clearance', checkPermission('product.bulk_edit'), c.clearanceMarkdown);
router.get('/forecast', checkPermission('inventory.report.view', V), c.getForecast);
router.get('/dead-stock', checkPermission('inventory.report.view', V), c.getDeadStock);
router.get('/', checkPermission('inventory.stock.view', V), c.listStock);
router.get('/products', checkPermission('inventory.stock.view', V), c.listStock);
router.get('/check', checkPermission('inventory.stock.view', V), c.checkStock);
router.get('/movements', checkPermission('inventory.movement.view', V), c.listMovements);
router.get('/movements/archive/preview', checkPermission('inventory.settings.update'), c.previewMovementArchive);
router.get('/movements/export', checkPermission('inventory.report.export'), c.exportMovements);
router.post('/movements/archive', checkPermission('inventory.settings.update'), c.archiveMovements);
router.get('/reservations', checkPermission('inventory.reservation.view', V), c.listReservations);
router.post('/reservations/:id/release', checkPermission('inventory.reservation.release'), c.releaseReservation);
router.post('/reservations/sweep', checkPermission('inventory.stock.adjust'), c.sweepReservations);

// Adjustments
router.get('/adjustments', checkPermission('inventory.stock.view', V), c.listAdjustments);
router.post('/adjustments', checkPermission('inventory.stock.adjust'), c.createAdjustment);
router.post('/adjustments/:id/approve', checkPermission('inventory.stock.adjust.approve'), c.approveAdjustment);
router.post('/adjustments/:id/reject', checkPermission('inventory.stock.adjust.approve'), c.rejectAdjustment);

// Warehouses
router.get('/warehouses', checkPermission('inventory.warehouse.view', V), c.listWarehouses);
router.post('/warehouses', checkPermission('inventory.warehouse.create'), c.createWarehouse);
router.put('/warehouses/:id', checkPermission('inventory.warehouse.update'), c.updateWarehouse);
router.delete('/warehouses/:id', checkPermission('inventory.warehouse.delete'), c.deleteWarehouse);

// Transfers
router.get('/transfers', checkPermission('inventory.transfer.view', V), c.listTransfers);
router.post('/transfers', checkPermission('inventory.transfer.create'), c.createTransfer);
router.post('/transfers/:id/approve', checkPermission('inventory.transfer.approve'), c.approveTransfer);
router.post('/transfers/:id/receive', checkPermission('inventory.transfer.receive'), c.receiveTransfer);
router.post('/transfers/:id/cancel', checkPermission('inventory.transfer.cancel', 'inventory.transfer.create'), c.cancelTransfer);

// Purchase receiving
router.post('/purchases/:id/receive', checkPermission('inventory.purchase.receive'), c.receivePurchaseOrder);

// Returns
router.get('/returns', checkPermission('inventory.return.view', V), c.listReturns);
router.post('/returns/:id/inspect', checkPermission('inventory.return.inspect'), c.inspectReturn);
router.post('/returns/:id/restock', checkPermission('inventory.return.restock'), c.inspectReturn);

// Batches / expiry
router.get('/batches', checkPermission('inventory.batch.view', V), c.listBatches);
router.post('/batches', checkPermission('inventory.batch.create'), c.createBatch);
router.put('/batches/:id', checkPermission('inventory.batch.update'), c.updateBatch);
router.get('/expiry', checkPermission('inventory.expiry.view', V), c.getExpiry);

// Damaged / lost
router.get('/damaged', checkPermission('inventory.damage.view', V), c.listDamagedLost);
router.post('/damaged', checkPermission('inventory.damage.create'), c.recordDamageLoss);
router.get('/lost', checkPermission('inventory.damage.view', V), c.listDamagedLost);
router.post('/lost', checkPermission('inventory.loss.create'), c.recordDamageLoss);

// Catalog maintenance (category table, bulk edit, CSV import + rollback)
router.get('/catalog', checkPermission('inventory.stock.view', V), c.getCatalog);
router.post('/catalog', checkPermission('product.import'), c.postCatalogCreate);
router.patch('/catalog/:id', checkPermission('product.bulk_edit'), c.patchCatalogItem);
router.post('/catalog/bulk', checkPermission('product.bulk_edit'), c.postCatalogBulk);
router.post('/catalog/validate', checkPermission('product.import'), c.postCatalogValidate);
router.post('/catalog/confirm', checkPermission('product.import'), c.postCatalogConfirm);
router.post('/catalog/batches/:batchId/rollback', checkPermission('product.import'), c.postCatalogRollback);
router.get('/catalog/batches', checkPermission('product.import', V), c.listCatalogBatches);

// Valuation / alerts / reports / audit / settings
router.get('/valuation', checkPermission('inventory.valuation.view', V), c.getValuation);
router.get('/alerts', checkPermission('inventory.alert.view', V), c.listAlerts);
router.patch('/alerts/:id', checkPermission('inventory.alert.manage'), c.ackAlert);
router.get('/reports', checkPermission('inventory.report.view', V), c.getReports);
router.get('/export', checkPermission('inventory.report.export'), c.exportCsv);
router.get('/audit-logs', checkPermission('inventory.audit.view', V), c.getAuditLogs);
router.get('/audit-logs/export', checkPermission('inventory.audit.view', V), c.exportAuditLogsCsv);
router.get('/audit-logs/archive/preview', checkPermission('inventory.settings.update'), c.previewAuditArchive);
router.get('/audit-logs/export', checkPermission('inventory.report.export'), c.exportAuditLogs);
router.post('/audit-logs/archive', checkPermission('inventory.settings.update'), c.archiveAuditLogs);
router.get('/settings', checkPermission('inventory.settings.view', V), c.getSettings);
router.put('/settings', checkPermission('inventory.settings.update'), c.updateSettings);
router.patch('/reorder', checkPermission('inventory.settings.update', 'inventory.stock.adjust'), c.updateReorder);

// Keep :id last so it never swallows named routes
router.get('/:id', checkPermission('inventory.stock.view', V), c.getStockOne);

export default router;

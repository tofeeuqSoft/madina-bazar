import express from 'express';
import { protect, checkPermission } from '../middleware/authMiddleware.js';
import * as c from '../controllers/deliveryAdminController.js';

const router = express.Router();
router.use(protect);

const V = 'delivery.view';
router.get('/dashboard', checkPermission('delivery.view', 'delivery.report.view'), c.getDashboard);
router.get('/growth', checkPermission('delivery.report.view', V), c.getGrowth);

// Zones — activation expands the own-delivery network without code changes
router.patch('/zones/:id/status', checkPermission('delivery.zone.activate', 'delivery.zone.update'), c.activateZone);

// Riders
router.get('/riders', checkPermission('delivery.rider.view', V), c.listRiders);
router.post('/riders', checkPermission('delivery.rider.create'), c.postRider);
router.patch('/riders/:id', checkPermission('delivery.rider.update'), c.patchRider);
router.get('/riders/capacity', checkPermission('delivery.rider.view', V), c.riderCapacity);
router.get('/riders/performance', checkPermission('delivery.report.view', V), c.riderPerformance);

// Shipments (Order Service never calls couriers — only this orchestrator)
router.get('/shipments', checkPermission('delivery.shipment.view', V), c.listShipments);
router.get('/shipments/:id', checkPermission('delivery.shipment.view', 'delivery.tracking.view'), c.getShipment);
router.post('/shipments/order/:id', checkPermission('delivery.shipment.create'), c.createShipmentForOrder);
router.post('/shipments/:id/retry', checkPermission('delivery.shipment.retry'), c.retryShipment);
router.post('/shipments/:id/rto', checkPermission('delivery.shipment.retry'), c.rtoShipment);
router.post('/shipments/:id/confirm-dispatch', checkPermission('order.confirm', 'delivery.shipment.create'), c.confirmDispatch);
router.post('/shipments/:id/pull-back', checkPermission('delivery.shipment.create', 'order.assign'), c.pullBackShipment);
router.get('/slots', checkPermission('DELIVERY_AREA_VIEW'), c.listSlotsAdmin);
router.post('/slots', checkPermission('DELIVERY_AREA_UPDATE'), c.createSlot);
router.patch('/slots/:id', checkPermission('DELIVERY_AREA_UPDATE'), c.patchSlot);
router.post('/shipments/:id/cancel', checkPermission('delivery.shipment.cancel'), c.cancelShipment);
router.post('/shipments/:id/assign-rider', checkPermission('delivery.rider.assign'), c.assignRiderTo);
router.post('/shipments/:id/reassign-rider', checkPermission('delivery.rider.assign'), c.reassignRiderTo);
router.post('/shipments/:id/event', checkPermission('delivery.shipment.view'), c.shipmentEvent);
router.get('/orders/:orderId/shipments', checkPermission('delivery.shipment.view', V), c.orderShipments);

// Zone assignment + capacity planning (expansion triggers rider planning)
router.post('/riders/assign-zone', checkPermission('delivery.rider.assign'), c.assignZoneTo);
router.get('/zones/:id/capacity-plan', checkPermission('delivery.report.view', V), c.zoneCapacityPlan);
router.get('/zones/:id/performance', checkPermission('delivery.report.view', V), c.zonePerformance);

// Shifts & attendance
router.get('/shifts', checkPermission('delivery.rider.view', V), c.listShifts);
router.post('/shifts', checkPermission('delivery.rider.update'), c.postShift);
router.post('/shifts/start', checkPermission('delivery.rider.update', 'delivery.rider.view'), c.startShiftFor);
router.post('/shifts/end', checkPermission('delivery.rider.update', 'delivery.rider.view'), c.endShiftFor);
router.post('/riders/presence', checkPermission('delivery.rider.update'), c.presenceFor);
router.get('/attendance', checkPermission('delivery.report.view', V), c.attendanceFor);

// Rider delivery actions (riders use these from the /rider app)
router.post('/shipments/:id/accept', checkPermission('delivery.shipment.view'), c.acceptShipment);
router.post('/shipments/:id/deliver', checkPermission('delivery.shipment.view'), c.deliverShipment);
router.post('/shipments/:id/fail', checkPermission('delivery.shipment.view'), c.failShipment);
router.get('/shipments/:id/attempts', checkPermission('delivery.shipment.view', V), c.shipmentAttempts);

// Rider COD + settlements
router.get('/cod/collections', checkPermission('delivery.settlement.view', V), c.codCollections);
router.post('/cod/:id/submit', checkPermission('delivery.settlement.view'), c.submitCod);
router.get('/settlements/preview', checkPermission('delivery.settlement.view', V), c.previewSettlement);
router.get('/settlements', checkPermission('delivery.settlement.view', V), c.listSettlements);
router.post('/settlements', checkPermission('delivery.settlement.view'), c.createSettlement);
router.post('/settlements/:id/approve', checkPermission('delivery.settlement.view'), c.approveSettlement);

// Couriers (registry + masked credentials — secrets never leave server)
router.get('/couriers', checkPermission('delivery.courier.view', V), c.listCouriers);
router.put('/couriers/:id', checkPermission('delivery.courier.manage'), c.updateCourier);
router.patch('/couriers/:id/status', checkPermission('delivery.courier.activate'), c.patchCourierStatus);
router.post('/couriers/credentials', checkPermission('delivery.courier.configure'), c.saveCredential);
router.get('/couriers/performance', checkPermission('delivery.report.view', V), c.courierPerformance);

// Tracking / settlement / reports / settings
router.get('/tracking/:id', checkPermission('delivery.tracking.view', V), c.getTracking);
router.get('/cod', checkPermission('delivery.settlement.view', V), c.getCod);
router.post('/cod/:id/settle', checkPermission('delivery.settlement.view'), c.postSettle);
router.post('/cod/:id/collect', checkPermission('delivery.settlement.view'), c.postCollect);
router.get('/reports', checkPermission('delivery.report.view', V), c.getReports);
router.get('/settings', checkPermission('delivery.view', V), c.getSettings);
router.put('/settings', checkPermission('delivery.courier.manage'), c.putSettings);
router.get('/webhooks', checkPermission('delivery.audit.view', V), c.webhookEvents);
router.get('/api-logs', checkPermission('delivery.audit.view', V), c.apiLogs);

export default router;

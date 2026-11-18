import { registerHandler, enqueue } from '../jobQueue.js';

// Courier work runs through the persistent queue so retries survive restarts.
// Same idempotency keys as the orchestrator — a job can never duplicate a shipment.

export const queueCourierCreate = ({ shipmentId, providerCode, attempt = 1 }) =>
  enqueue({
    type: 'COURIER_CREATE',
    payload: { shipmentId, providerCode, attempt },
    idempotencyKey: `JOB:COURIER_CREATE:${shipmentId}:${attempt}`,
  });

export const queueTrackingSync = ({ shipmentId }) =>
  enqueue({
    type: 'TRACKING_SYNC',
    payload: { shipmentId },
    idempotencyKey: `JOB:TRACKING:${shipmentId}:${new Date().toISOString().slice(0, 13)}`,
    delayMs: 60 * 60 * 1000,
  });

export const registerDeliveryJobs = () => {
  registerHandler('COURIER_CREATE', async ({ shipmentId, providerCode }) => {
    const Shipment = (await import('../../models/Shipment.js')).default;
    const CourierProvider = (await import('../../models/CourierProvider.js')).default;
    const { getAdapter } = await import('./adapters/index.js');
    const { recordProviderResult } = await import('./courierSelectionService.js');
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment || ['DELIVERED', 'CANCELLED'].includes(shipment.status)) return;
    const provider = await CourierProvider.findOne({ code: providerCode, status: 'ACTIVE' });
    if (!provider) throw new Error(`${providerCode} not active`);
    const res = await getAdapter(providerCode).createShipment({ providerDoc: provider, shipment });
    if (!res.ok) throw new Error(res.message || res.code);
    shipment.courierShipmentId = res.shipmentId || '';
    shipment.trackingNumber = res.trackingNumber || '';
    shipment.status = 'PENDING_PICKUP';
    shipment.statusHistory.push({ status: 'PENDING_PICKUP', note: `Created via job (${providerCode})` });
    await shipment.save();
    await recordProviderResult({ code: providerCode, success: true });
  });

  registerHandler('TRACKING_SYNC', async ({ shipmentId }) => {
    const Shipment = (await import('../../models/Shipment.js')).default;
    const CourierProvider = (await import('../../models/CourierProvider.js')).default;
    const { transitionShipment } = await import('./shipmentService.js');
    const { normalizeStatus } = await import('./deliveryLogic.js');
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment || ['DELIVERED', 'CANCELLED', 'RETURNED'].includes(shipment.status)) return;
    if (shipment.deliveryMode !== 'EXTERNAL_COURIER') return;
    const provider = await CourierProvider.findOne({ code: shipment.provider });
    if (!provider) return;
    const { getAdapter } = await import('./adapters/index.js');
    const res = await getAdapter(shipment.provider).getShipmentStatus({ providerDoc: provider, shipment });
    if (res.ok && res.status) {
      await transitionShipment({ shipment, status: normalizeStatus(res.status), note: 'Tracking sync' });
    }
  });

  registerHandler('COURIER_RETRY', async ({ shipmentId }) => {
    const Shipment = (await import('../../models/Shipment.js')).default;
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) return;
    const { routeOrder } = await import('./orchestratorService.js');
    await routeOrder({ orderId: shipment.order, attempt: (shipment.attempt || 1) + 1 });
  });
};

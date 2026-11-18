import Order from '../../models/Order.js';
import Payment from '../../models/Payment.js';
import Return from '../../models/Return.js';
import Product from '../../models/Product.js';
import FAQArticle from '../../models/FAQArticle.js';
import { logSupportAction } from './auditService.js';

// AUTHORIZED AI TOOL LAYER (future AI uses ONLY these — never direct DB).
// Financial actions are READ-ONLY by default; writes require explicit permission
// checked in the controller (SUPPORT_REFUND_REQUEST / SUPPORT_REFUND_APPROVE).
export const AI_TOOLS = [
  'getCustomerOrders',
  'getOrderDetails',
  'getOrderStatus',
  'getPaymentStatus',
  'getDeliveryStatus',
  'checkDeliveryAvailability',
  'getReturnStatus',
  'getRefundStatus',
  'getProductInformation',
  'knowledgeSearch',
  'createSupportTicket',
  'addCustomerMessage',
  'requestReturn',
  'getOrderTimeline',
  'checkOrderCancellationEligibility',
  'createCancellationRequest',
  // Inventory — READ-ONLY (mutations need explicit permission + approval)
  'getStock',
  'getAvailableStock',
  'getLowStockProducts',
  'getOutOfStockProducts',
  'getWarehouseStock',
  'getInventoryMovement',
  'getExpiryProducts',
  'getInventoryAlerts',
  'checkProductAvailability',
];

const auditTool = (tool, args, actor) =>
  logSupportAction({
    actorType: 'AI_AGENT',
    actor: actor?._id || null,
    aiAgentId: 'ai-assistant',
    action: 'AI_TOOL_USED',
    module: 'SUPPORT_AI',
    referenceId: tool,
    newValue: args,
    toolUsed: tool,
  });

export const getCustomerOrders = async (customerId, actor = null) => {
  await auditTool('getCustomerOrders', { customerId }, actor);
  return Order.find({ customer: customerId }).sort({ createdAt: -1 }).limit(10).select('orderNumber orderStatus paymentStatus totalAmount createdAt');
};

export const getOrderDetails = async (orderId, actor = null) => {
  await auditTool('getOrderDetails', { orderId }, actor);
  return Order.findById(orderId).select('orderNumber orderStatus paymentStatus items subtotal discount deliveryCharge totalAmount createdAt');
};

export const getOrderStatus = async (orderId, actor = null) => {
  await auditTool('getOrderStatus', { orderId }, actor);
  const o = await Order.findById(orderId).select('orderNumber orderStatus paymentStatus');
  return o ? { orderNumber: o.orderNumber, orderStatus: o.orderStatus, paymentStatus: o.paymentStatus } : null;
};

export const getPaymentStatus = async (orderId, actor = null) => {
  await auditTool('getPaymentStatus', { orderId }, actor);
  const p = await Payment.findOne({ order: orderId }).sort({ createdAt: -1 }).select('amount status method transactionId');
  return p;
};

export const getDeliveryStatus = async (orderId, actor = null) => {
  await auditTool('getDeliveryStatus', { orderId }, actor);
  const o = await Order.findById(orderId).select('orderNumber orderStatus shippingAddress deliveryStatus');
  return o;
};

export const checkDeliveryAvailability = async (args, actor = null) => {
  await auditTool('checkDeliveryAvailability', args, actor);
  // Delegates to existing delivery logic — support never duplicates pricing rules.
  return { available: true, note: 'Checked via delivery service (stub). Wire to /api/delivery/check.' };
};

export const getReturnStatus = async (returnId, actor = null) => {
  await auditTool('getReturnStatus', { returnId }, actor);
  return Return.findById(returnId).select('returnNumber status refundStatus refundAmount reason');
};

export const getRefundStatus = async (returnId, actor = null) => {
  await auditTool('getRefundStatus', { returnId }, actor);
  const r = await Return.findById(returnId).select('returnNumber refundStatus refundAmount refundMethod');
  return r ? { returnNumber: r.returnNumber, refundStatus: r.refundStatus, amount: r.refundAmount, method: r.refundMethod } : null;
};

export const getProductInformation = async (productId, actor = null) => {
  await auditTool('getProductInformation', { productId }, actor);
  return Product.findById(productId).select('name price stock images category');
};

export const knowledgeSearch = async (query, actor = null) => {
  await auditTool('knowledgeSearch', { query }, actor);
  return FAQArticle.find({ $text: { $search: query }, isActive: true }).limit(5).select('title category tags content');
};

// ---- Order-management read-only tools (via Order Service, never raw writes) ----
export const getOrderTimeline = async (orderId, actor = null) => {
  await auditTool('getOrderTimeline', { orderId }, actor);
  const Order = (await import('../../models/Order.js')).default;
  const o = await Order.findById(orderId).select('orderNumber orderStatus statusHistory createdAt');
  return o;
};

export const checkOrderCancellationEligibility = async (orderId, actor = null) => {
  await auditTool('checkOrderCancellationEligibility', { orderId }, actor);
  const Order = (await import('../../models/Order.js')).default;
  const { canCancel } = await import('../orderMgmt/orderStatusService.js');
  const o = await Order.findById(orderId).select('orderNumber orderStatus');
  if (!o) return { eligible: false, reason: 'Order not found' };
  return { eligible: canCancel(o.orderStatus), orderStatus: o.orderStatus };
};

export const createSupportTicket = async ({ customerId, subject, category, description = '', priority = 'MEDIUM' }, actor = null) => {
  await auditTool('createSupportTicket', { customerId, subject }, actor);
  const { createTicket } = await import('./ticketService.js');
  const SupportCategory = (await import('../../models/SupportCategory.js')).default;
  let categoryId = category;
  if (category && !String(category).match(/^[0-9a-fA-F]{24}$/)) {
    const found = await SupportCategory.findOne({ slug: String(category).toLowerCase().replace(/[^a-z0-9]+/g, '-') });
    categoryId = found?._id || null;
  }
  return createTicket({ data: { customer: customerId, subject, description, category: categoryId, priority }, actor });
};

export const addCustomerMessage = async ({ ticketId, content }, actor = null) => {
  await auditTool('addCustomerMessage', { ticketId }, actor);
  const SupportTicket = (await import('../../models/SupportTicket.js')).default;
  const { addMessage } = await import('./ticketService.js');
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) {
    const e = new Error('Ticket not found');
    e.statusCode = 404;
    throw e;
  }
  return addMessage({ ticket, senderType: 'CUSTOMER', senderId: ticket.customer, content });
};

export const requestReturn = async ({ orderId, reason }, actor = null) => {
  // Request ONLY — inspection + refund stay human-gated via Return workflow
  await auditTool('requestReturn', { orderId, reason }, actor);
  const Order = (await import('../../models/Order.js')).default;
  const Return = (await import('../../models/Return.js')).default;
  const order = await Order.findById(orderId);
  if (!order) {
    const e = new Error('Order not found');
    e.statusCode = 404;
    throw e;
  }
  const existing = await Return.findOne({ order: orderId, status: { $in: ['Requested', 'Approved'] } });
  if (existing) return { queued: false, returnId: existing._id, note: 'Return already requested' };
  const ret = await Return.create({
    order: orderId,
    type: 'SALE_RETURN',
    items: (order.orderItems || []).filter((i) => i.product).map((i) => ({ product: i.product, name: i.name, quantity: i.quantity, price: i.price })),
    refundAmount: order.paidAmount || 0,
    reason: reason || 'AI-assisted return request (pending human review)',
    status: 'Requested',
    createdBy: actor?._id || null,
  });
  return { queued: true, returnId: ret._id };
};

export const createCancellationRequest = async ({ orderId, reason }, actor = null) => {
  // Request only — human ORDER_MANAGER approves via /api/admin/orders/:id/cancel
  await auditTool('createCancellationRequest', { orderId, reason }, actor);
  return { queued: true, orderId, reason: reason || 'CUSTOMER_REQUEST', note: 'Cancellation request logged for human review. AI cannot cancel directly.' };
};

// ---- Inventory READ-ONLY tools (via Inventory Service, never direct writes) ----
const invQuery = async () => import('../inventory/inventoryQueryService.js');

export const getStock = async ({ productId, warehouseId }, actor = null) => {
  await auditTool('getStock', { productId, warehouseId }, actor);
  const { default: InventoryStock } = await import('../../models/InventoryStock.js');
  return InventoryStock.find({ product: productId, ...(warehouseId ? { warehouse: warehouseId } : {}) }).select('sku available onHand reserved status reorderLevel');
};

export const getAvailableStock = async ({ productId }, actor = null) => {
  await auditTool('getAvailableStock', { productId }, actor);
  const { checkAvailable } = await import('../inventory/stockService.js');
  const r = await checkAvailable({ productId, quantity: 1 });
  return { available: r.available, sufficientForOne: r.sufficient };
};

export const getLowStockProducts = async (args = {}, actor = null) => {
  await auditTool('getLowStockProducts', args, actor);
  const { default: InventoryStock } = await import('../../models/InventoryStock.js');
  return InventoryStock.find({ status: 'LOW_STOCK' }).populate('product', 'name sku').limit(20).select('product sku available reorderLevel');
};

export const getOutOfStockProducts = async (args = {}, actor = null) => {
  await auditTool('getOutOfStockProducts', args, actor);
  const { default: InventoryStock } = await import('../../models/InventoryStock.js');
  return InventoryStock.find({ status: 'OUT_OF_STOCK' }).populate('product', 'name sku').limit(20).select('product sku');
};

export const getWarehouseStock = async ({ warehouseId }, actor = null) => {
  await auditTool('getWarehouseStock', { warehouseId }, actor);
  const { default: InventoryStock } = await import('../../models/InventoryStock.js');
  return InventoryStock.find({ warehouse: warehouseId }).populate('product', 'name sku').limit(50).select('product sku available status');
};

export const getInventoryMovement = async ({ productId }, actor = null) => {
  await auditTool('getInventoryMovement', { productId }, actor);
  const q = await invQuery();
  const [data] = await q.movementList({ product: productId, limit: 10 });
  return data;
};

export const getExpiryProducts = async ({ days = 30 }, actor = null) => {
  await auditTool('getExpiryProducts', { days }, actor);
  const { default: InventoryBatch } = await import('../../models/InventoryBatch.js');
  return InventoryBatch.find({ expiryStatus: { $in: ['EXPIRING_SOON', 'EXPIRED'] } }).populate('product', 'name sku').limit(20);
};

export const getInventoryAlerts = async (args = {}, actor = null) => {
  await auditTool('getInventoryAlerts', args, actor);
  const { default: InventoryAlert } = await import('../../models/InventoryAlert.js');
  return InventoryAlert.find({ status: 'ACTIVE' }).limit(20);
};

export const checkProductAvailability = async ({ productId, quantity = 1 }, actor = null) => {
  await auditTool('checkProductAvailability', { productId, quantity }, actor);
  const { checkAvailable } = await import('../inventory/stockService.js');
  const r = await checkAvailable({ productId, quantity });
  return { available: r.available, canFulfill: r.sufficient };
};

// ---- Delivery READ-ONLY tools (routing/shipments via Delivery Service) ----
const DELIVERY_TOOLS = [
  'getDeliveryZone',
  'getOwnDeliveryCoverage',
  'getShipmentStatus',
  'getRiderStatus',
  'getRiderCapacity',
  'getCourierStatus',
  'getDeliveryEstimate',
  'getDeliveryPerformance',
];
AI_TOOLS.push(...DELIVERY_TOOLS);

export const getDeliveryZone = async ({ zoneId }, actor = null) => {
  await auditTool('getDeliveryZone', { zoneId }, actor);
  const { default: GroceryZone } = await import('../../models/GroceryZone.js');
  return GroceryZone.findById(zoneId).select('name district status deliveryMode deliveryCharge estimatedDeliveryTime');
};

export const getOwnDeliveryCoverage = async (args = {}, actor = null) => {
  await auditTool('getOwnDeliveryCoverage', args, actor);
  const { networkFootprint } = await import('../delivery/coverageService.js');
  return networkFootprint();
};

export const getShipmentStatus = async ({ orderId }, actor = null) => {
  await auditTool('getShipmentStatus', { orderId }, actor);
  const { default: Shipment } = await import('../../models/Shipment.js');
  return Shipment.find({ order: orderId }).select('shipmentNo deliveryMode provider status trackingNumber createdAt');
};

export const getRiderStatus = async ({ riderId }, actor = null) => {
  await auditTool('getRiderStatus', { riderId }, actor);
  const { default: Rider } = await import('../../models/Rider.js');
  return Rider.findById(riderId).select('status isAvailable currentAssignedOrders maxDailyOrders');
};

export const getRiderCapacity = async ({ zoneId }, actor = null) => {
  await auditTool('getRiderCapacity', { zoneId }, actor);
  const { riderCapacityToday } = await import('../delivery/riderService.js');
  return riderCapacityToday({ zoneId });
};

export const getCourierStatus = async (args = {}, actor = null) => {
  await auditTool('getCourierStatus', args, actor);
  const { default: CourierProvider } = await import('../../models/CourierProvider.js');
  return CourierProvider.find({}).select('code status priority successRate');
};

export const getDeliveryEstimate = async ({ placeId, district }, actor = null) => {
  await auditTool('getDeliveryEstimate', { placeId, district }, actor);
  const { resolveCoverage } = await import('../delivery/coverageService.js');
  const c = await resolveCoverage({ placeId, district });
  if (!c) return { deliverable: true, mode: 'EXTERNAL_COURIER', note: 'Outside own zones — courier' };
  return { deliverable: c.status === 'ACTIVE', mode: c.deliveryMode, charge: c.deliveryCharge, eta: c.estimatedDeliveryTime, zone: c.zoneName };
};

export const getDeliveryPerformance = async (args = {}, actor = null) => {
  await auditTool('getDeliveryPerformance', args, actor);
  const { deliveryDashboard } = await import('../delivery/deliveryReportService.js');
  const d = await deliveryDashboard();
  return { network: d.network, performance: d.performance, flow: d.flow };
};

import Shipment from '../../models/Shipment.js';
import Order from '../../models/Order.js';

const maskPhone = (p) => (p ? `${String(p).slice(0, 4)}****` : '');

// Unified customer tracking — internal courier details stay hidden.
export const customerTracking = async ({ orderId, customerId }) => {
  const order = await Order.findById(orderId).populate('customer', 'name phone');
  if (!order) {
    const e = new Error('Order not found');
    e.statusCode = 404;
    throw e;
  }
  if (customerId && String(order.customer?._id || order.customer) !== String(customerId)) {
    const e = new Error('Not authorized');
    e.statusCode = 403;
    throw e;
  }
  const shipments = await Shipment.find({ order: orderId }).populate({ path: 'rider', populate: { path: 'user', select: 'name phone' } }).sort({ createdAt: -1 });
  return {
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    shipments: shipments.map((s) => ({
      shipmentNo: s.shipmentNo,
      deliveryMode: s.deliveryMode,
      provider: s.deliveryMode === 'OWN_DELIVERY' ? 'Own Delivery' : s.provider,
      rider: s.rider ? { name: s.rider.user?.name || '', phone: maskPhone(s.rider.user?.phone) } : null,
      trackingNumber: s.trackingNumber || s.shipmentNo,
      status: s.status,
      expected: order.expectedDelivery || null,
      history: (s.statusHistory || []).map((h) => ({ status: h.status, at: h.timestamp })),
    })),
  };
};

export const adminTracking = async (shipmentId) => {
  const s = await Shipment.findById(shipmentId).populate('order', 'orderNumber').populate({ path: 'rider', populate: { path: 'user', select: 'name phone' } });
  if (!s) {
    const e = new Error('Shipment not found');
    e.statusCode = 404;
    throw e;
  }
  return s;
};

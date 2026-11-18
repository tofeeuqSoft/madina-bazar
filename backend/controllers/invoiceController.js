import Order from '../models/Order.js';
import Settings from '../models/Settings.js';

/**
 * @desc    Get invoice data (JSON) for an order
 * @route   GET /api/invoices/:orderId
 * @access  Private (owner or staff)
 */
export const getInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('customer', 'name email phone')
      .populate('deliveryArea', 'name')
      .populate('orderItems.product', 'name unit')
      .populate('orderItems.combo', 'name');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const isOwner = order.customer?._id?.toString() === req.user.id || order.customer?.toString() === req.user.id;
    const isStaff = ['SUPER_ADMIN', 'SUB_ADMIN', 'ORDER_MANAGER', 'ACCOUNTANT'].includes(req.user.role);
    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    let settings = await Settings.findOne();
    if (!settings) settings = {};

    const invoice = {
      invoiceNumber: `INV-${order.orderNumber}`,
      orderNumber: order.orderNumber,
      date: order.createdAt,
      store: {
        name: settings.websiteName || 'Madina Bazar',
        phone: settings.phone || '',
        email: settings.email || '',
        address: settings.address || 'Mirpur, Dhaka',
      },
      customer: {
        name: order.shippingAddress?.fullName || order.customer?.name,
        phone: order.shippingAddress?.phone || order.customer?.phone,
        email: order.customer?.email,
        address: order.shippingAddress?.address,
        area: order.shippingAddress?.area || order.deliveryArea?.name,
      },
      items: (order.orderItems || []).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit || '',
        size: item.size || '',
        color: item.color || '',
        price: item.price,
        total: item.price * item.quantity,
      })),
      subtotal: order.subtotal,
      deliveryCharge: order.deliveryCharge,
      discount: order.discount || 0,
      couponCode: order.couponCode || null,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      transactionId:
        order.paymentMeta?.trxID ||
        order.paymentMeta?.bankTranId ||
        order.paymentMeta?.paymentRefId ||
        null,
    };

    res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    HTML invoice page (print-friendly)
 * @route   GET /api/invoices/:orderId/print
 */
export const printInvoice = async (req, res) => {
  try {
    // Reuse logic via internal call pattern
    const order = await Order.findById(req.params.orderId)
      .populate('customer', 'name email phone')
      .populate('deliveryArea', 'name');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    const isOwner =
      order.customer?._id?.toString() === req.user?.id ||
      order.customer?.toString() === req.user?.id;
    const isStaff = ['SUPER_ADMIN', 'SUB_ADMIN', 'ORDER_MANAGER', 'ACCOUNTANT'].includes(
      req.user?.role
    );
    if (!isOwner && !isStaff) {
      return res.status(403).send('Not authorized');
    }

    const settings = (await Settings.findOne()) || {};
    // VAT regime from the order snapshot (historical truth); BIN is business-level.
    const AccSettings = (await import('../models/AccountingSettings.js')).default;
    const acc = await AccSettings.findOne().sort({ updatedAt: -1 }).lean().catch(() => null);
    const vatMode = order.taxMode || acc?.vatMode || 'EXCLUSIVE';
    const vatRate = order.taxRateSnap ?? acc?.taxRate ?? 0;
    const vatName = order.taxNameSnap || acc?.taxName || 'VAT';
    const vatBin = acc?.vatBin || '';
    const vatAmount = order.taxAmount || 0;
    const vatLine = vatAmount > 0
      ? (vatMode === 'INCLUSIVE'
        ? `<div style="font-size:13px;color:#555">Inclusive ${vatName} (${vatRate}%): ৳${vatAmount}</div>`
        : `<div>${vatName} (${vatRate}%): ৳${vatAmount}</div>`)
      : '';
    const itemsRows = (order.orderItems || [])
      .map(
        (item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.name}${item.unit ? ` (${item.unit})` : ''}${item.size || item.color ? ` [${[item.size, item.color].filter(Boolean).join(' / ')}]` : ''}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">৳${item.price}</td>
        <td style="text-align:right">৳${item.price * item.quantity}</td>
      </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${order.orderNumber}</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:800px;margin:24px auto;color:#111}
  h1{margin:0} table{width:100%;border-collapse:collapse;margin-top:16px}
  th,td{border:1px solid #ddd;padding:8px;font-size:14px}
  th{background:#f5f5f5} .meta{display:flex;justify-content:space-between;gap:24px;margin-top:16px}
  .total{text-align:right;margin-top:12px;font-size:16px}
  @media print{button{display:none}}
</style></head><body>
  <button onclick="window.print()">Print</button>
  <h1>${settings.websiteName || 'Madina Bazar'}</h1>
  <p>${settings.address || 'Mirpur, Dhaka'} · ${settings.phone || ''} · ${settings.email || ''}${vatBin ? ` · BIN: ${vatBin}` : ''}</p>
  <hr/>
  <div class="meta">
    <div>
      <strong>Invoice:</strong> INV-${order.orderNumber}<br/>
      <strong>Date:</strong> ${new Date(order.createdAt).toLocaleString('en-BD')}<br/>
      <strong>Payment:</strong> ${order.paymentMethod} (${order.paymentStatus})
    </div>
    <div>
      <strong>Bill To:</strong><br/>
      ${order.shippingAddress?.fullName || ''}<br/>
      ${order.shippingAddress?.phone || ''}<br/>
      ${order.shippingAddress?.address || ''}<br/>
      ${order.shippingAddress?.area || order.deliveryArea?.name || ''}
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
    <tbody>${itemsRows}</tbody>
  </table>
  <div class="total">
    <div>Subtotal: ৳${order.subtotal}</div>
    <div>Delivery: ৳${order.deliveryCharge}</div>
    ${order.discount ? `<div>Discount: -৳${order.discount}</div>` : ''}
    ${vatLine}
    <div><strong>Total: ৳${order.totalAmount}</strong></div>
  </div>
  <p style="margin-top:32px;font-size:12px;color:#666">Thank you for shopping with Madina Bazar.</p>
</body></html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

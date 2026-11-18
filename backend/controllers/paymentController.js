import Order from '../models/Order.js';
import Settings from '../models/Settings.js';
import * as bkash from '../utils/bkash.js';
import * as nagad from '../utils/nagad.js';
import * as sslcommerz from '../utils/sslcommerz.js';
import { claimTxn } from '../services/paymentTxnService.js';
import { markOrderPaid, markOrderFailed } from '../services/paymentFinalizeService.js';

// Canonical txn row at initiate time (best-effort — never breaks the redirect).
const trackInitiated = async ({ gateway, gatewayTxnId, order }) => {
  try {
    await claimTxn({ gateway, gatewayTxnId, order: order._id, orderNumber: order.orderNumber, amount: order.totalAmount, status: 'INITIATED' });
  } catch (e) {
    console.error('[txn-track]', e.message);
  }
};

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || process.env.SERVER_URL || 'http://localhost:5000';

/**
 * @desc    Initiate payment for an order
 * @route   POST /api/payments/initiate
 * @access  Private
 */
export const initiatePayment = async (req, res) => {
  try {
    const { orderId, paymentMethod } = req.body;

    if (!orderId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'orderId and paymentMethod are required',
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (order.paymentStatus === 'Paid') {
      return res.status(400).json({ success: false, message: 'Order already paid' });
    }

    // Check settings toggles
    let settings = await Settings.findOne();
    if (!settings) settings = {};

    const method = paymentMethod.toUpperCase();

    // —— COD ——
    if (method === 'COD') {
      if (settings.enableCOD === false) {
        return res.status(400).json({ success: false, message: 'COD is disabled' });
      }
      order.paymentMethod = 'COD';
      order.paymentStatus = 'Pending';
      await order.save();
      return res.status(200).json({
        success: true,
        message: 'Cash on Delivery selected',
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentMethod: 'COD',
          paymentStatus: 'Pending',
          redirectUrl: null,
        },
      });
    }

    // —— bKash ——
    if (method === 'BKASH') {
      if (settings.enableBkash === false) {
        return res.status(400).json({ success: false, message: 'bKash is disabled' });
      }
      if (!bkash.isBkashConfigured()) {
        return res.status(503).json({
          success: false,
          message: 'bKash is not configured. Add BKASH_* env variables.',
        });
      }

      const callbackURL = `${API_URL}/api/payments/bkash/callback`;
      const payment = await bkash.createPayment({
        amount: order.totalAmount,
        orderNumber: order.orderNumber,
        payerReference: order.shippingAddress?.phone || req.user.phone || '01XXXXXXXXX',
        callbackURL,
      });

      order.paymentMethod = 'BKASH';
      order.paymentStatus = 'Pending';
      order.paymentMeta = {
        gateway: 'bkash',
        paymentID: payment.paymentID,
        merchantInvoice: order.orderNumber,
      };
      await order.save();
      await trackInitiated({ gateway: 'BKASH', gatewayTxnId: payment.paymentID, order });

      return res.status(200).json({
        success: true,
        message: 'bKash payment initiated',
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentMethod: 'BKASH',
          paymentID: payment.paymentID,
          redirectUrl: payment.bkashURL,
        },
      });
    }

    // —— Nagad ——
    if (method === 'NAGAD') {
      if (settings.enableNagad === false) {
        return res.status(400).json({ success: false, message: 'Nagad is disabled' });
      }
      if (!nagad.isNagadConfigured()) {
        return res.status(503).json({
          success: false,
          message: 'Nagad is not configured. Add NAGAD_* env variables.',
        });
      }

      const callbackURL = `${API_URL}/api/payments/nagad/callback`;
      const clientIp =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        '127.0.0.1';

      const payment = await nagad.createPayment({
        amount: order.totalAmount,
        orderId: order.orderNumber,
        productDetails: { orderId: String(order._id) },
        clientIp,
        callbackURL,
      });

      order.paymentMethod = 'NAGAD';
      order.paymentStatus = 'Pending';
      order.paymentMeta = {
        gateway: 'nagad',
        paymentRefId: payment.paymentRefId,
        merchantInvoice: order.orderNumber,
      };
      await order.save();
      await trackInitiated({ gateway: 'NAGAD', gatewayTxnId: payment.paymentRefId, order });

      return res.status(200).json({
        success: true,
        message: 'Nagad payment initiated',
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentMethod: 'NAGAD',
          paymentRefId: payment.paymentRefId,
          redirectUrl: payment.redirectURL,
        },
      });
    }

    
    // —— SSLCommerz ——
    if (method === 'SSLCOMMERZ') {
      if (settings.enableSSLCommerz === false) {
        return res.status(400).json({ success: false, message: 'SSLCommerz is disabled' });
      }
      if (!sslcommerz.isSSLCommerzConfigured()) {
        return res.status(503).json({
          success: false,
          message: 'SSLCommerz is not configured. Add SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD.',
        });
      }

      const tranId = `${order.orderNumber}-${Date.now()}`;
      const session = await sslcommerz.initPayment({
        amount: order.totalAmount,
        tranId,
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        successURL: `${API_URL}/api/payments/sslcommerz/success`,
        failURL: `${API_URL}/api/payments/sslcommerz/fail`,
        cancelURL: `${API_URL}/api/payments/sslcommerz/cancel`,
        ipnURL: `${API_URL}/api/payments/sslcommerz/ipn`,
        customerName: order.shippingAddress?.fullName || req.user.name,
        customerEmail: req.user.email || 'customer@madinabazar.com',
        customerPhone: order.shippingAddress?.phone || req.user.phone,
        customerAddress: order.shippingAddress?.address || 'Dhaka',
        customerCity: order.shippingAddress?.city || 'Dhaka',
        productName: `Order ${order.orderNumber}`,
      });

      order.paymentMethod = 'SSLCOMMERZ';
      order.paymentStatus = 'Pending';
      order.paymentMeta = {
        gateway: 'sslcommerz',
        tranId,
        sessionkey: session.sessionkey,
        merchantInvoice: order.orderNumber,
      };
      await order.save();
      await trackInitiated({ gateway: 'SSLCOMMERZ', gatewayTxnId: tranId, order });

      return res.status(200).json({
        success: true,
        message: 'SSLCommerz payment initiated',
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentMethod: 'SSLCOMMERZ',
          sessionkey: session.sessionkey,
          redirectUrl: session.GatewayPageURL,
        },
      });
    }

return res.status(400).json({
      success: false,
      message: 'Invalid payment method. Use COD, BKASH, NAGAD, or SSLCOMMERZ',
    });
  } catch (error) {
    console.error('initiatePayment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    bKash callback (redirect from bKash)
 * @route   GET /api/payments/bkash/callback
 * @access  Public
 */
export const bkashCallback = async (req, res) => {
  try {
    const { paymentID, status } = req.query;

    if (!paymentID) {
      return res.redirect(`${CLIENT_URL}/payment/failed?reason=missing_payment_id`);
    }

    if (status && status.toLowerCase() === 'cancel') {
      return res.redirect(`${CLIENT_URL}/payment/failed?reason=cancelled&gateway=bkash`);
    }

    if (status && status.toLowerCase() === 'failure') {
      return res.redirect(`${CLIENT_URL}/payment/failed?reason=failed&gateway=bkash`);
    }

    // Execute payment
    let result = await bkash.executePayment(paymentID);

    // If execute fails, try query
    if (!result.transactionStatus || result.transactionStatus === 'Initiated') {
      result = await bkash.queryPayment(paymentID);
    }

    const order = await Order.findOne({
      'paymentMeta.paymentID': paymentID,
    });

    if (!order) {
      return res.redirect(`${CLIENT_URL}/payment/failed?reason=order_not_found`);
    }

    const isSuccess =
      result.transactionStatus === 'Completed' ||
      result.statusCode === '0000' ||
      result.trxID;
    const gwKey = result.trxID || paymentID;

    if (isSuccess) {
      await markOrderPaid(order, {
        gateway: 'BKASH',
        gatewayTxnId: gwKey,
        raw: result,
        note: `Paid via bKash. TrxID: ${result.trxID || paymentID}`,
        extraMeta: { trxID: result.trxID, transactionStatus: result.transactionStatus || 'Completed' },
      });
      return res.redirect(
        `${CLIENT_URL}/payment/success?order=${order.orderNumber}&trx=${result.trxID || ''}&gateway=bkash`
      );
    }

    await markOrderFailed(order, { gateway: 'BKASH', gatewayTxnId: gwKey, raw: result, status: result.transactionStatus || 'Failed' });
    return res.redirect(`${CLIENT_URL}/payment/failed?order=${order.orderNumber}&gateway=bkash`);
  } catch (error) {
    console.error('bkashCallback error:', error);
    return res.redirect(`${CLIENT_URL}/payment/failed?reason=server_error&gateway=bkash`);
  }
};

/**
 * @desc    Nagad callback
 * @route   GET /api/payments/nagad/callback
 * @access  Public
 */
export const nagadCallback = async (req, res) => {
  try {
    const { payment_ref_id, status, order_id } = req.query;
    const paymentRefId = payment_ref_id || req.query.paymentRefId;

    if (!paymentRefId) {
      return res.redirect(`${CLIENT_URL}/payment/failed?reason=missing_ref&gateway=nagad`);
    }

    // Find order first so verify binds the response to OUR order number
    // (decrypt-check rejects merchant/order mismatch as forgery).
    const order =
      (await Order.findOne({ 'paymentMeta.paymentRefId': paymentRefId })) ||
      (order_id ? await Order.findOne({ orderNumber: order_id }) : null);

    if (!order) {
      return res.redirect(`${CLIENT_URL}/payment/failed?reason=order_not_found&gateway=nagad`);
    }

    // Verify with Nagad (bound to this order — throws on forgery)
    let verified = null;
    try {
      verified = await nagad.verifyPayment(paymentRefId, order.orderNumber);
    } catch (e) {
      console.error('Nagad verify error:', e.message);
      return res.redirect(`${CLIENT_URL}/payment/failed?reason=verify_failed&gateway=nagad`);
    }

    const statusStr = String(status || verified?.status || '').toUpperCase();
    const isSuccess =
      statusStr === 'SUCCESS' ||
      statusStr === 'COMPLETED' ||
      verified?.status === 'Success' ||
      verified?.statusCode === 'Success';

    if (isSuccess) {
      await markOrderPaid(order, {
        gateway: 'NAGAD',
        gatewayTxnId: paymentRefId,
        raw: verified || req.query,
        note: `Paid via Nagad. Ref: ${paymentRefId}`,
        extraMeta: { paymentRefId, transactionStatus: 'Completed' },
      });
      return res.redirect(
        `${CLIENT_URL}/payment/success?order=${order.orderNumber}&trx=${paymentRefId}&gateway=nagad`
      );
    }

    await markOrderFailed(order, { gateway: 'NAGAD', gatewayTxnId: paymentRefId, raw: verified || req.query, status: statusStr || 'Failed' });
    return res.redirect(`${CLIENT_URL}/payment/failed?order=${order.orderNumber}&gateway=nagad`);
  } catch (error) {
    console.error('nagadCallback error:', error);
    return res.redirect(`${CLIENT_URL}/payment/failed?reason=server_error&gateway=nagad`);
  }
};


/**
 * SSLCommerz success redirect
 */
export const sslcommerzSuccess = async (req, res) => {
  try {
    const valId = req.body?.val_id || req.query?.val_id;
    const tranId = req.body?.tran_id || req.query?.tran_id;

    if (valId) {
      const validated = await sslcommerz.validatePayment(valId);
      const status = validated.status || '';
      const order =
        (await Order.findOne({ 'paymentMeta.tranId': tranId })) ||
        (await Order.findOne({ orderNumber: validated.value_b })) ||
        (await Order.findById(validated.value_a));

      const gwKey = validated.bank_tran_id || tranId;
      if (order && (status === 'VALID' || status === 'VALIDATED')) {
        await markOrderPaid(order, {
          gateway: 'SSLCOMMERZ',
          gatewayTxnId: gwKey,
          raw: validated,
          note: `Paid via SSLCommerz. Bank Trx: ${validated.bank_tran_id || valId}`,
          extraMeta: { valId, bankTranId: validated.bank_tran_id, transactionStatus: 'Completed' },
        });
        return res.redirect(
          `${CLIENT_URL}/payment/success?order=${order.orderNumber}&trx=${validated.bank_tran_id || valId}&gateway=sslcommerz`
        );
      }
    }
    return res.redirect(`${CLIENT_URL}/payment/failed?gateway=sslcommerz`);
  } catch (error) {
    console.error('sslcommerzSuccess:', error);
    return res.redirect(`${CLIENT_URL}/payment/failed?reason=server_error&gateway=sslcommerz`);
  }
};

export const sslcommerzFail = async (req, res) => {
  const tranId = req.body?.tran_id || req.query?.tran_id;
  if (tranId) {
    const order = await Order.findOne({ 'paymentMeta.tranId': tranId });
    if (order) {
      order.paymentStatus = 'Failed';
      await order.save();
      return res.redirect(`${CLIENT_URL}/payment/failed?order=${order.orderNumber}&gateway=sslcommerz`);
    }
  }
  return res.redirect(`${CLIENT_URL}/payment/failed?gateway=sslcommerz`);
};

export const sslcommerzCancel = async (req, res) => {
  return res.redirect(`${CLIENT_URL}/payment/failed?reason=cancelled&gateway=sslcommerz`);
};

/** IPN (server-to-server) */
export const sslcommerzIpn = async (req, res) => {
  try {
    // Forged IPNs must not move money: signature first, validation second.
    // (Even if this rejects, the 30m reconciler confirms via validate API.)
    if (process.env.SSLCOMMERZ_SKIP_SIGN_VERIFY !== 'true' && !sslcommerz.verifyIpnSign(req.body || {})) {
      console.error('[ssl-ipn] signature mismatch', { tran_id: req.body?.tran_id });
      return res.status(403).send('bad signature');
    }
    const valId = req.body?.val_id;
    const tranId = req.body?.tran_id;
    if (!valId) return res.status(400).send('invalid');

    const validated = await sslcommerz.validatePayment(valId);
    if (validated.status === 'VALID' || validated.status === 'VALIDATED') {
      const order =
        (await Order.findOne({ 'paymentMeta.tranId': tranId })) ||
        (await Order.findOne({ orderNumber: validated.value_b }));
      if (order) {
        await markOrderPaid(order, {
          gateway: 'SSLCOMMERZ',
          gatewayTxnId: validated.bank_tran_id || tranId,
          raw: validated,
          note: `IPN Paid via SSLCommerz`,
          extraMeta: { valId, bankTranId: validated.bank_tran_id, ipn: true },
        });
      }
    }
    res.status(200).send('OK');
  } catch (error) {
    console.error('sslcommerzIpn:', error);
    res.status(500).send('error');
  }
};

/**
 * @desc    Reconcile stuck Pending payments against gateways (Admin/cron)
 * @route   POST /api/payments/reconcile
 */
export const reconcilePayments = async (req, res) => {
  try {
    const { reconcilePendingPayments } = await import('../services/paymentReconcileService.js');
    const report = await reconcilePendingPayments({});
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Manual payment status update (Admin)
 * @route   PATCH /api/payments/:orderId/status
 */
export const updatePaymentStatus = async (req, res) => {
  try {
    const { status, transactionId, note } = req.body;
    const allowed = ['Pending', 'Paid', 'Failed', 'Refunded'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status required: Pending, Paid, Failed, Refunded',
      });
    }

    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.paymentStatus = status;
    if (transactionId) {
      order.paymentMeta = {
        ...(order.paymentMeta || {}),
        trxID: transactionId,
        manualUpdate: true,
      };
    }
    order.statusHistory.push({
      status: order.orderStatus,
      changedBy: req.user.id,
      note: note || `Payment marked as ${status}${transactionId ? ` | Txn: ${transactionId}` : ''}`,
      timestamp: new Date(),
    });
    await order.save();

    // Accounting autopilot (best-effort)
    try {
      const { recordSale, recordPayment } = await import('../services/accountingService.js');
      if (status === 'Paid') {
        await recordSale(order, { actorId: req.user.id, req });
        const remaining = Math.max(0, (order.totalAmount || 0) - (order.paidAmount || 0));
        if (remaining > 0) {
          await recordPayment(order, {
            amount: remaining,
            method: order.paymentMethod,
            txnId: transactionId || order.paymentMeta?.trxID || '',
            actorId: req.user.id,
            note: note || 'Manual payment update',
            req,
          });
        }
      }
    } catch (e) {
      console.error('[accounting autopilot]', e.message);
    }

    res.status(200).json({
      success: true,
      message: `Payment status updated to ${status}`,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Payment gateway status (configured or not)
 * @route   GET /api/payments/gateways
 * @access  Public
 */
export const getGateways = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = {};

    res.status(200).json({
      success: true,
      data: {
        COD: {
          enabled: settings.enableCOD !== false,
          configured: true,
        },
        BKASH: {
          enabled: settings.enableBkash === true,
          configured: bkash.isBkashConfigured(),
        },
        NAGAD: {
          enabled: settings.enableNagad === true,
          configured: nagad.isNagadConfigured(),
        },
        SSLCOMMERZ: {
          enabled: settings.enableSSLCommerz === true,
          configured: sslcommerz.isSSLCommerzConfigured(),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

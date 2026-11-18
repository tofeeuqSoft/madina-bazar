/**
 * SSLCommerz Payment Gateway
 * Docs: https://developer.sslcommerz.com
 *
 * Writes (init/refund-init): timeout only. Reads (validate/refund-status):
 * timeout + 1 retry. See utils/gatewayHttp.js.
 */
import crypto from 'crypto';
import { gatewayRead, gatewayWrite } from './gatewayHttp.js';

const SANDBOX_INIT = 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php';
const LIVE_INIT = 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';
const SANDBOX_VALIDATE = 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php';
const LIVE_VALIDATE = 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php';
const SANDBOX_REFUND = 'https://sandbox.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php';
const LIVE_REFUND = 'https://securepay.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php';

const getConfig = () => {
  const isLive = process.env.SSLCOMMERZ_LIVE === 'true';
  return {
    storeId: process.env.SSLCOMMERZ_STORE_ID,
    storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD,
    isLive,
    initURL: isLive ? LIVE_INIT : SANDBOX_INIT,
    validateURL: isLive ? LIVE_VALIDATE : SANDBOX_VALIDATE,
    refundURL: isLive ? LIVE_REFUND : SANDBOX_REFUND,
  };
};

export const isSSLCommerzConfigured = () => {
  const c = getConfig();
  return Boolean(c.storeId && c.storePassword);
};

/**
 * Initialize payment session
 * @returns { GatewayPageURL, sessionkey, ... }
 */
export const initPayment = async (payload) => {
  const config = getConfig();
  if (!isSSLCommerzConfigured()) {
    throw new Error('SSLCommerz not configured. Set SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD');
  }

  const body = new URLSearchParams({
    store_id: config.storeId,
    store_passwd: config.storePassword,
    total_amount: String(Number(payload.amount).toFixed(2)),
    currency: 'BDT',
    tran_id: payload.tranId,
    success_url: payload.successURL,
    fail_url: payload.failURL,
    cancel_url: payload.cancelURL,
    ipn_url: payload.ipnURL || '',
    shipping_method: 'Courier',
    product_name: payload.productName || 'Madina Bazar Order',
    product_category: 'Grocery',
    product_profile: 'general',
    cus_name: payload.customerName || 'Customer',
    cus_email: payload.customerEmail || 'customer@madinabazar.com',
    cus_add1: payload.customerAddress || 'Dhaka',
    cus_city: payload.customerCity || 'Dhaka',
    cus_country: 'Bangladesh',
    cus_phone: payload.customerPhone || '01XXXXXXXXX',
    ship_name: payload.customerName || 'Customer',
    ship_add1: payload.customerAddress || 'Dhaka',
    ship_city: payload.customerCity || 'Dhaka',
    ship_country: 'Bangladesh',
    value_a: payload.orderId || '',
    value_b: payload.orderNumber || '',
  });

  const res = await gatewayWrite(config.initURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await res.json();
  if (!data.GatewayPageURL) {
    throw new Error(data.failedreason || data.status || 'SSLCommerz init failed');
  }
  return data;
};

/**
 * Validate transaction by val_id
 */
export const validatePayment = async (valId) => {
  const config = getConfig();
  if (!isSSLCommerzConfigured()) {
    throw new Error('SSLCommerz not configured');
  }

  const url = `${config.validateURL}?val_id=${encodeURIComponent(valId)}&store_id=${encodeURIComponent(config.storeId)}&store_passwd=${encodeURIComponent(config.storePassword)}&format=json`;

  const res = await gatewayRead(url);
  return res.json();
};

/**
 * Verify IPN/success-post authenticity via verify_sign + verify_key.
 * Scheme: md5(join(values of verify_key fields in order) + store_passwd).
 * Returns true when the post is genuinely from SSLCommerz.
 */
export const verifyIpnSign = (body = {}) => {
  const { verify_sign, verify_key } = body;
  if (!verify_sign || !verify_key) return false;
  const config = getConfig();
  const values = String(verify_key).split(',').map((k) => String(body[k.trim()] ?? ''));
  const hash = crypto.createHash('md5').update(values.join('') + config.storePassword).digest('hex');
  return hash === String(verify_sign).toLowerCase();
};

/**
 * Initiate a refund (full or partial) against a bank transaction.
 * Stable refundRefId per Return keeps retries idempotent on our side.
 * @returns gateway response (status 'success' = accepted; confirm via queryRefundStatus)
 */
export const initRefund = async ({ bankTranId, refundAmount, refundRefId, remarks }) => {
  const config = getConfig();
  if (!isSSLCommerzConfigured()) {
    throw new Error('SSLCommerz not configured');
  }
  if (!bankTranId) throw new Error('bankTranId is required for SSLCommerz refund');

  const params = new URLSearchParams({
    store_id: config.storeId,
    store_passwd: config.storePassword,
    format: 'json',
    bank_tran_id: bankTranId,
    refund_amount: String(Number(refundAmount).toFixed(2)),
    refund_remarks: remarks || 'Order cancelled/returned',
    refund_ref_id: refundRefId,
  });
  const res = await gatewayWrite(`${config.refundURL}?${params.toString()}`);
  const data = await res.json();
  if (data.APIConnect !== 'SUCCESS' || data.status === 'failed') {
    throw new Error(data.failedreason || data.status || 'SSLCommerz refund init failed');
  }
  return data;
};

/**
 * Query refund status (refunded / processing / cancelled).
 */
export const queryRefundStatus = async ({ bankTranId, refundRefId }) => {
  const config = getConfig();
  if (!isSSLCommerzConfigured()) {
    throw new Error('SSLCommerz not configured');
  }
  const params = new URLSearchParams({
    store_id: config.storeId,
    store_passwd: config.storePassword,
    format: 'json',
    bank_tran_id: bankTranId || '',
    refund_ref_id: refundRefId || '',
  });
  const res = await gatewayRead(`${config.refundURL}?${params.toString()}`);
  return res.json();
};

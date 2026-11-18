/**
 * bKash Tokenized Checkout API
 * Docs: https://developer.bka.sh
 *
 * Flow: Grant Token → Create Payment → Redirect user → Execute Payment (on callback)
 *
 * Writes (grant/create/execute/refund): timeout only, never auto-retried.
 * Reads (query): timeout + 1 retry. See utils/gatewayHttp.js.
 */
import { gatewayRead, gatewayWrite } from './gatewayHttp.js';

const BKASH_SANDBOX = {
  grantToken: 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/token/grant',
  refreshToken: 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/token/refresh',
  createPayment: 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/create',
  executePayment: 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/execute',
  queryPayment: 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/payment/status',
  refund: 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/payment/refund',
};

const BKASH_LIVE = {
  grantToken: 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout/token/grant',
  refreshToken: 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout/token/refresh',
  createPayment: 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout/create',
  executePayment: 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout/execute',
  queryPayment: 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout/payment/status',
  refund: 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout/payment/refund',
};

let cachedToken = null;
let tokenExpiresAt = 0;

const getConfig = () => {
  const isSandbox = process.env.BKASH_SANDBOX !== 'false';
  return {
    username: process.env.BKASH_USERNAME,
    password: process.env.BKASH_PASSWORD,
    appKey: process.env.BKASH_APP_KEY,
    appSecret: process.env.BKASH_APP_SECRET,
    isSandbox,
    urls: isSandbox ? BKASH_SANDBOX : BKASH_LIVE,
  };
};

export const isBkashConfigured = () => {
  const c = getConfig();
  return Boolean(c.username && c.password && c.appKey && c.appSecret);
};

export const grantToken = async () => {
  const config = getConfig();
  if (!isBkashConfigured()) {
    throw new Error('bKash credentials not configured. Set BKASH_USERNAME, BKASH_PASSWORD, BKASH_APP_KEY, BKASH_APP_SECRET');
  }

  // Reuse cached token if still valid (with 2 min buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 120000) {
    return cachedToken;
  }

  const res = await gatewayWrite(config.urls.grantToken, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      username: config.username,
      password: config.password,
    },
    body: JSON.stringify({
      app_key: config.appKey,
      app_secret: config.appSecret,
    }),
  });

  const data = await res.json();
  if (!data.id_token) {
    throw new Error(data.statusMessage || data.message || 'Failed to grant bKash token');
  }

  cachedToken = data.id_token;
  // Token typically valid 1 hour
  tokenExpiresAt = Date.now() + 55 * 60 * 1000;
  return cachedToken;
};

export const createPayment = async ({ amount, orderNumber, payerReference, callbackURL }) => {
  const config = getConfig();
  const token = await grantToken();

  const res = await gatewayWrite(config.urls.createPayment, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      authorization: token,
      'x-app-key': config.appKey,
    },
    body: JSON.stringify({
      mode: '0011',
      payerReference: payerReference || '01XXXXXXXXX',
      callbackURL,
      amount: String(Number(amount).toFixed(2)),
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: orderNumber,
    }),
  });

  const data = await res.json();
  if (!data.paymentID) {
    throw new Error(data.statusMessage || data.message || 'bKash create payment failed');
  }

  return data; // paymentID, bkashURL, ...
};

export const executePayment = async (paymentID) => {
  const config = getConfig();
  const token = await grantToken();

  const res = await gatewayWrite(config.urls.executePayment, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      authorization: token,
      'x-app-key': config.appKey,
    },
    body: JSON.stringify({ paymentID }),
  });

  const data = await res.json();
  return data;
};

export const queryPayment = async (paymentID) => {
  const config = getConfig();
  const token = await grantToken();

  const res = await gatewayRead(`${config.urls.queryPayment}?paymentID=${paymentID}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      authorization: token,
      'x-app-key': config.appKey,
    },
  });

  return res.json();
};

/**
 * Refund a completed payment (partial or full).
 * @returns gateway response (refundTrxID on success)
 */
export const refundPayment = async ({ trxID, amount, reason }) => {
  const config = getConfig();
  if (!trxID) throw new Error('trxID is required for bKash refund');
  const token = await grantToken();

  const res = await gatewayWrite(config.urls.refund, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      authorization: token,
      'x-app-key': config.appKey,
    },
    body: JSON.stringify({
      trxID,
      amount: String(Number(amount).toFixed(2)),
      sku: 'refund',
      reason: reason || 'Order cancelled/returned',
    }),
  });

  const data = await res.json();
  if (!data.refundTrxID && data.statusCode !== '0000') {
    throw new Error(data.statusMessage || data.message || 'bKash refund failed');
  }
  return data;
};

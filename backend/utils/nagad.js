/**
 * Nagad Payment Gateway (DFS Checkout)
 * Uses RSA encrypt (PG public key) + sign (merchant private key)
 *
 * Flow: Initialize → Complete → Redirect user → Verify on callback
 */

import crypto from 'crypto';
import { gatewayRead, gatewayWrite } from './gatewayHttp.js';

const NAGAD_SANDBOX = 'https://sandbox.mynagad.com:10060/remote-payment-gateway-1.0/api/dfs';
const NAGAD_LIVE = 'https://api.mynagad.com/api/dfs';

const getConfig = () => {
  const isSandbox = process.env.NAGAD_SANDBOX !== 'false';
  return {
    merchantId: process.env.NAGAD_MERCHANT_ID,
    merchantNumber: process.env.NAGAD_MERCHANT_NUMBER,
    privateKey: process.env.NAGAD_MERCHANT_PRIVATE_KEY,
    publicKey: process.env.NAGAD_PG_PUBLIC_KEY,
    isSandbox,
    baseURL: isSandbox ? NAGAD_SANDBOX : NAGAD_LIVE,
  };
};

export const isNagadConfigured = () => {
  const c = getConfig();
  return Boolean(c.merchantId && c.merchantNumber && c.privateKey && c.publicKey);
};

const normalizeKey = (key, type) => {
  if (!key) return key;
  if (key.includes('BEGIN')) return key.replace(/\\n/g, '\n');
  const body = key.replace(/\s+/g, '');
  if (type === 'private') {
    return `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----`;
  }
  return `-----BEGIN PUBLIC KEY-----\n${body.match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`;
};

const getDateTime = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
};

const signData = (data, privateKeyPem) => {
  const signer = crypto.createSign('SHA256');
  signer.update(JSON.stringify(data));
  signer.end();
  return signer.sign(normalizeKey(privateKeyPem, 'private'), 'base64');
};

const encryptData = (data, publicKeyPem) => {
  const buffer = Buffer.from(JSON.stringify(data));
  const encrypted = crypto.publicEncrypt(
    {
      key: normalizeKey(publicKeyPem, 'public'),
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    buffer
  );
  return encrypted.toString('base64');
};

const decryptData = (encryptedBase64, privateKeyPem) => {
  const decrypted = crypto.privateDecrypt(
    {
      key: normalizeKey(privateKeyPem, 'private'),
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(encryptedBase64, 'base64')
  );
  return JSON.parse(decrypted.toString('utf8'));
};

/**
 * Create Nagad payment and return redirect URL
 */
export const createPayment = async ({
  amount,
  orderId,
  productDetails = {},
  clientIp = '127.0.0.1',
  callbackURL,
}) => {
  const config = getConfig();
  if (!isNagadConfigured()) {
    throw new Error(
      'Nagad credentials not configured. Set NAGAD_MERCHANT_ID, NAGAD_MERCHANT_NUMBER, NAGAD_MERCHANT_PRIVATE_KEY, NAGAD_PG_PUBLIC_KEY'
    );
  }

  const datetime = getDateTime();
  const sensitiveData = {
    merchantId: config.merchantId,
    datetime,
    orderId: String(orderId),
    challenge: crypto.randomBytes(20).toString('hex'),
  };

  const initBody = {
    accountNumber: config.merchantNumber,
    dateTime: datetime,
    sensitiveData: encryptData(sensitiveData, config.publicKey),
    signature: signData(sensitiveData, config.privateKey),
  };

  // Step 1: Initialize (write — timeout only, never auto-retried)
  const initRes = await gatewayWrite(
    `${config.baseURL}/check-out/initialize/${config.merchantId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KM-Api-Version': 'v-0.2.0',
        'X-KM-IP-V4': clientIp,
        'X-KM-Client-Type': 'PC_WEB',
      },
      body: JSON.stringify(initBody),
    }
  );

  const initData = await initRes.json();
  if (!initData.sensitiveData) {
    throw new Error(initData.message || initData.reason || 'Nagad initialize failed');
  }

  const decrypted = decryptData(initData.sensitiveData, config.privateKey);
  const paymentReferenceId = decrypted.paymentReferenceId;
  const challenge = decrypted.challenge;

  // Step 2: Complete
  const completeSensitive = {
    merchantId: config.merchantId,
    orderId: String(orderId),
    currencyCode: '050',
    amount: String(Number(amount).toFixed(2)),
    challenge,
  };

  const completeBody = {
    paymentRefId: paymentReferenceId,
    sensitiveData: encryptData(completeSensitive, config.publicKey),
    signature: signData(completeSensitive, config.privateKey),
    merchantCallbackURL: callbackURL,
    additionalMerchantInfo: productDetails,
  };

  const completeRes = await gatewayWrite(
    `${config.baseURL}/check-out/complete/${paymentReferenceId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KM-Api-Version': 'v-0.2.0',
        'X-KM-IP-V4': clientIp,
        'X-KM-Client-Type': 'PC_WEB',
      },
      body: JSON.stringify(completeBody),
    }
  );

  const completeData = await completeRes.json();
  if (!completeData.callBackUrl && !completeData.redirectGatewayURL) {
    throw new Error(completeData.message || completeData.reason || 'Nagad complete failed');
  }

  return {
    paymentRefId: paymentReferenceId,
    redirectURL: completeData.callBackUrl || completeData.redirectGatewayURL,
    raw: completeData,
  };
};

/**
 * Decrypt + authenticate a Nagad verify-response.
 * Fail-closed ONLY when encrypted data is present but invalid; responses
 * without sensitiveData keep legacy behavior (server query is still the proof).
 */
export const decryptAndValidate = (data, expectedOrderId = '') => {
  const config = getConfig();
  if (!data?.sensitiveData) return data;
  let dec;
  try {
    dec = decryptData(data.sensitiveData, config.privateKey);
  } catch {
    throw new Error('Nagad verify decrypt failed — possible forgery');
  }
  if (dec.merchantId !== config.merchantId) {
    throw new Error('Nagad merchant mismatch — possible forgery');
  }
  if (expectedOrderId && String(dec.orderId || '') !== String(expectedOrderId)) {
    throw new Error('Nagad order mismatch — possible forgery');
  }
  return { ...data, decrypted: dec };
};

/**
 * Verify Nagad payment from callback query params.
 * expectedOrderId (our orderNumber) binds the response to the order.
 */
export const verifyPayment = async (paymentRefId, expectedOrderId = '') => {
  const config = getConfig();
  if (!isNagadConfigured()) {
    throw new Error('Nagad not configured');
  }

  const res = await gatewayRead(
    `${config.baseURL}/verify/payment/${paymentRefId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-KM-Api-Version': 'v-0.2.0',
        'X-KM-IP-V4': '127.0.0.1',
        'X-KM-Client-Type': 'PC_WEB',
      },
    }
  );

  return decryptAndValidate(await res.json(), expectedOrderId);
};

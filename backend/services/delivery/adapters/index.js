import CourierCredential, { decryptSecret } from '../../../models/CourierCredential.js';
import CourierApiLog from '../../../models/CourierApiLog.js';

// Adapter contract every provider implements:
// createShipment | cancelShipment | getShipmentStatus | getTracking |
// createPickupRequest | requestReturn
//
// Wiring (no guessing): admin saves baseUrl + per-operation PATHS from the
// provider's CURRENT official docs (CourierProvider.apiPaths) plus encrypted
// credentials. Until paths+credentials exist every method returns
// { ok:false, code:'NOT_CONFIGURED' } so the selection engine treats the
// provider as unavailable and falls back — never failing an order.

const log = async ({ provider, operation, shipment, success, responseCode = '', error = '', durationMs = 0, referenceId = '' }) => {
  try {
    await CourierApiLog.create({ provider, operation, shipment: shipment || null, referenceId, responseCode, success, durationMs, error });
  } catch (_) {}
};

const credsOf = async (providerDoc) => {
  const cred = await CourierCredential.findOne({ provider: providerDoc._id }).select('+baseUrl +apiKey +apiSecret +merchantId');
  if (!cred?.baseUrl || !cred?.apiKey) return null;
  return {
    baseUrl: cred.baseUrl.replace(/\/$/, ''),
    apiKey: decryptSecret(cred.apiKey),
    apiSecret: decryptSecret(cred.apiSecret || ''),
    merchantId: cred.merchantId || '',
  };
};

const fail = async ({ provider, operation, shipment, code, message }) => {
  await log({ provider: provider.code, operation, shipment: shipment?._id, success: false, error: code });
  return { ok: false, code, message };
};

// Generic JSON call. Payload mapping per provider lives in PATHS.payload builders
// (completed from official docs); auth header scheme per provider config.
const call = async ({ providerDoc, creds, path, operation, shipment, payload = {}, authStyle = 'bearer' }) => {
  const started = Date.now();
  const headers = { 'Content-Type': 'application/json' };
  if (authStyle === 'bearer') headers.Authorization = `Bearer ${creds.apiKey}`;
  else if (authStyle === 'api-key') {
    headers['Api-Key'] = creds.apiKey;
    if (creds.apiSecret) headers['Secret-Key'] = creds.apiSecret;
  }
  try {
    const res = await fetch(`${creds.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    await log({ provider: providerDoc.code, operation, shipment: shipment?._id, success: res.ok, responseCode: String(res.status), durationMs: Date.now() - started });
    if (!res.ok) return { ok: false, code: 'PROVIDER_ERROR', message: data.message || `HTTP ${res.status}`, data };
    return { ok: true, data };
  } catch (e) {
    await log({ provider: providerDoc.code, operation, shipment: shipment?._id, success: false, error: e.message, durationMs: Date.now() - started });
    return { ok: false, code: 'NETWORK_ERROR', message: e.message };
  }
};

// Minimal order → provider payload (providers accept extra fields; mapping
// refined per official docs via apiPaths + credential merchantId).
const basePayload = (shipment, order, creds) => ({
  invoice: shipment.shipmentNo,
  recipient_name: order?.shippingAddress?.fullName || '',
  recipient_phone: order?.shippingAddress?.phone || '',
  recipient_address: [order?.shippingAddress?.address, order?.shippingAddress?.area, order?.shippingAddress?.city].filter(Boolean).join(', '),
  cod_amount: shipment.codAmount || 0,
  merchant_id: creds.merchantId || undefined,
});

const makeAdapter = (code, authStyle = 'bearer') => {
  const op = (operation, pathKey) => async ({ providerDoc, shipment, order = null }) => {
    const creds = await credsOf(providerDoc);
    if (!creds) return fail({ provider: providerDoc, operation, shipment, code: 'NOT_CONFIGURED', message: `${code} credentials not configured` });
    const path = providerDoc.apiPaths?.[pathKey];
    if (!path) return fail({ provider: providerDoc, operation, shipment, code: 'NOT_CONFIGURED', message: `${code}.${pathKey} path not configured — fill from official docs` });
    const res = await call({ providerDoc, creds, path, operation, shipment, payload: basePayload(shipment, order, creds), authStyle });
    if (!res.ok) return res;
    const d = res.data || {};
    return {
      ok: true,
      shipmentId: d.consignment_id || d.consignmentId || d.tracking_id || d.id || '',
      trackingNumber: d.tracking_code || d.trackingCode || d.tracking_id || '',
      status: d.status || '',
      cost: d.delivery_charge || d.deliveryCharge || 0,
      data: undefined,
    };
  };
  return {
    createShipment: op('CREATE_SHIPMENT', 'createShipment'),
    cancelShipment: op('CANCEL_SHIPMENT', 'cancelShipment'),
    getShipmentStatus: op('STATUS', 'status'),
    getTracking: op('TRACKING', 'tracking'),
    createPickupRequest: op('PICKUP', 'pickup'),
    requestReturn: op('RETURN', 'return'),
  };
};

export const adapters = {
  STEADFAST: makeAdapter('STEADFAST', 'api-key'),
  PATHAO: makeAdapter('PATHAO', 'bearer'),
  CARIBEE: makeAdapter('CARIBEE', 'bearer'),
  PAPERFLY: makeAdapter('PAPERFLY', 'bearer'),
};

export const getAdapter = (code) => adapters[code] || null;

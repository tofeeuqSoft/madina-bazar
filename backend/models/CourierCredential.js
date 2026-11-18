import mongoose from 'mongoose';
import crypto from 'crypto';

// Server-side courier secrets. NEVER returned by any API (select:false),
// NEVER logged. Values encrypted at rest with CREDENTIAL_SECRET.
const ALGO = 'aes-256-gcm';

export function encryptSecret(plain) {
  const secret = process.env.CREDENTIAL_SECRET || process.env.JWT_ACCESS_SECRET || 'dev-secret';
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plain || ''), 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc.toString('hex')}`;
}

export function decryptSecret(payload) {
  const secret = process.env.CREDENTIAL_SECRET || process.env.JWT_ACCESS_SECRET || 'dev-secret';
  const key = crypto.createHash('sha256').update(secret).digest();
  const [ivHex, tagHex, dataHex] = String(payload || '').split(':');
  if (!ivHex || !tagHex || !dataHex) return '';
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

const courierCredentialSchema = new mongoose.Schema(
  {
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'CourierProvider', required: true, unique: true },
    environment: { type: String, enum: ['SANDBOX', 'LIVE'], default: 'LIVE' },
    baseUrl: { type: String, default: '', select: false },
    apiKey: { type: String, default: '', select: false },
    apiSecret: { type: String, default: '', select: false },
    merchantId: { type: String, default: '', select: false },
    // Webhook signing secret (per provider) — verified on every webhook hit
    webhookSecret: { type: String, default: '', select: false },
  },
  { timestamps: true }
);

const CourierCredential = mongoose.model('CourierCredential', courierCredentialSchema);
export default CourierCredential;

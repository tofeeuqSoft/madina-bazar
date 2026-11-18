import speakeasy from 'speakeasy';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendTokenResponse } from '../utils/generateToken.js';
import { logAudit } from '../utils/auditLog.js';

const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Setup: generate secret (scan into authenticator app, then verify to enable)
export const setup2fa = asyncH(async (req, res) => {
  const secret = speakeasy.generateSecret({ name: `MadinaBazar:${req.user.email || req.user.id}` });
  await User.findByIdAndUpdate(req.user.id, { twoFactorSecret: secret.base32 });
  res.json({ success: true, data: { otpauthUrl: secret.otpauth_url, secret: secret.base32 } });
});

export const verify2fa = asyncH(async (req, res) => {
  const { token } = req.body;
  const user = await User.findById(req.user.id).select('+twoFactorSecret');
  if (!user?.twoFactorSecret) {
    return res.status(400).json({ success: false, message: '2FA not initialized — call setup first' });
  }
  const ok = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token, window: 1 });
  if (!ok) return res.status(400).json({ success: false, message: 'Invalid authenticator code' });
  user.twoFactorEnabled = true;
  await user.save();
  try {
    logAudit(req, { action: '2FA_ENABLED', entity: 'User', entityId: user._id });
  } catch (_) {}
  res.json({ success: true, message: 'Two-factor authentication enabled' });
});

export const disable2fa = asyncH(async (req, res) => {
  const { token, password } = req.body;
  const user = await User.findById(req.user.id).select('+password +twoFactorSecret');
  if (!user?.twoFactorEnabled) return res.json({ success: true, message: '2FA already off' });
  if (user.authProvider === 'local') {
    if (!password || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Password confirmation required' });
    }
  }
  const ok = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token, window: 1 });
  if (!ok) return res.status(400).json({ success: false, message: 'Invalid authenticator code' });
  user.twoFactorEnabled = false;
  user.twoFactorSecret = '';
  await user.save();
  res.json({ success: true, message: 'Two-factor authentication disabled' });
});

// Second login step: tempToken (5 min) + TOTP → full httpOnly session
export const login2fa = asyncH(async (req, res) => {
  const { tempToken, token } = req.body;
  if (!tempToken || !token) {
    return res.status(400).json({ success: false, message: 'tempToken and token are required' });
  }
  let decoded;
  try {
    decoded = jwt.verify(tempToken, process.env.JWT_ACCESS_SECRET);
  } catch (_) {
    return res.status(401).json({ success: false, message: 'Session expired — login again' });
  }
  if (decoded.purpose !== '2fa') {
    return res.status(401).json({ success: false, message: 'Invalid session' });
  }
  const user = await User.findById(decoded.id).select('+twoFactorSecret');
  if (!user || !user.isActive || !user.twoFactorEnabled) {
    return res.status(401).json({ success: false, message: 'Invalid session' });
  }
  const ok = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token, window: 1 });
  if (!ok) return res.status(401).json({ success: false, message: 'Invalid authenticator code' });
  sendTokenResponse(user, 200, res);
});

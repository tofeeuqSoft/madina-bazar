import User from '../models/User.js';
import { sendTokenResponse, generateAccessToken, generateRefreshToken } from '../utils/generateToken.js';
import { sendEmail, sendSMS } from '../utils/notifications.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// @desc    Register new customer
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, phone and password',
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email
          ? 'Email already registered'
          : 'Phone number already registered',
      });
    }

    // Create customer
    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: 'CUSTOMER',
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration',
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if ((!email && !phone) || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email/phone and password',
      });
    }

    // Find user by email or phone
    const query = email ? { email } : { phone };
    const user = await User.findOne(query).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Social-only account (no password set)
    if (!user.password && user.authProvider !== 'local') {
      const via = user.authProvider === 'google' ? 'Google' : 'Facebook';
      return res.status(400).json({
        success: false,
        message: `This account uses ${via} login. Please continue with ${via}.`,
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been disabled. Please contact admin.',
      });
    }

    // Two-factor gate: password OK but TOTP still required (no session yet)
    if (user.twoFactorEnabled) {
      const tempToken = jwt.sign(
        { id: user._id, purpose: '2fa' },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '5m' }
      );
      return res.status(200).json({ success: true, requires2fa: true, tempToken });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
};

// @desc    Logout user / clear cookies
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
  res.cookie('accessToken', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.cookie('refreshToken', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Refresh Access Token
// @route   POST /api/auth/refresh
// @access  Public (needs refresh token)
export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token provided',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken(user._id);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: 'Token refreshed',
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token',
    });
  }
};

// @desc    Update own profile (name + avatar)
// @route   PUT /api/auth/profile
// @access  Private (any logged-in user)
export const updateProfile = async (req, res) => {
  try {
    const { name, avatar, phone } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name !== undefined) {
      const clean = String(name).trim();
      if (!clean || clean.length < 2) {
        return res.status(400).json({ success: false, message: 'Name must be at least 2 characters' });
      }
      user.name = clean;
    }
    if (avatar !== undefined) {
      user.avatar = String(avatar).trim();
    }
    // Phone can only be set once — for social signups that started
    // with a placeholder. Local accounts keep their registered number.
    if (phone !== undefined) {
      const cleanPhone = String(phone).replace(/[\s-]/g, '');
      if (!isPlaceholderPhone(user.phone)) {
        return res.status(400).json({ success: false, message: 'Phone number cannot be changed. Contact support.' });
      }
      if (!/^01\d{9}$/.test(cleanPhone)) {
        return res.status(400).json({ success: false, message: 'Enter a valid phone number (01XXXXXXXXX)' });
      }
      const taken = await User.findOne({ phone: cleanPhone, _id: { $ne: user._id } });
      if (taken) {
        return res.status(400).json({ success: false, message: 'This phone number is already registered' });
      }
      user.phone = cleanPhone;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated',
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Update password
// @route   PUT /api/auth/update-password
// @access  Private
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password',
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'This account uses social login and has no password to change.',
      });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    user.password = newPassword;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// ---------- Password recovery via OTP (email or phone/SMS) ----------

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const hashOTP = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

const findByIdentifier = async (identifier, withSecret = false) => {
  const id = String(identifier || '').trim();
  if (!id) return { user: null, channel: null };
  if (id.includes('@')) {
    const q = User.findOne({ email: id.toLowerCase() });
    return { user: await (withSecret ? q.select('+resetOTPHash') : q), channel: 'email' };
  }
  const phone = id.replace(/[\s-]/g, '');
  const q = User.findOne({ phone });
  return { user: await (withSecret ? q.select('+resetOTPHash') : q), channel: 'sms' };
};

const maskDestination = (channel, value) => {
  if (channel === 'email') {
    const [u, d] = String(value).split('@');
    return `${u.slice(0, 2)}***@${d}`;
  }
  const p = String(value).replace(/[\s-]/g, '');
  return p.length > 5 ? `${p.slice(0, 4)}***${p.slice(-3)}` : '***';
};

const checkOTP = (user, otp) => {
  if (!user || !user.resetOTPHash || !user.resetOTPExpire || user.resetOTPExpire < new Date()) {
    return { ok: false, message: 'OTP expired. Please request a new one.' };
  }
  if ((user.resetOTPAttempts || 0) >= OTP_MAX_ATTEMPTS) {
    return { ok: false, message: 'Too many wrong attempts. Please request a new OTP.' };
  }
  if (hashOTP(String(otp).trim()) !== user.resetOTPHash) {
    return { ok: false, message: 'Incorrect OTP. Please try again.' };
  }
  return { ok: true };
};

// @desc    Request password-reset OTP (email or phone)
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email, phone } = req.body;
    const identifier = email || phone;
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Email or phone number is required' });
    }

    const { user, channel } = await findByIdentifier(identifier);
    // Generic response when account doesn't exist (anti-enumeration)
    if (!user || !user.isActive) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists, an OTP has been sent.',
      });
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    user.resetOTPHash = hashOTP(otp);
    user.resetOTPExpire = new Date(Date.now() + OTP_TTL_MS);
    user.resetOTPAttempts = 0;
    user.resetOTPVerified = false;
    user.resetOTPVerifiedExpire = undefined;
    await user.save({ validateBeforeSave: false });

    const sacred = channel === 'email' ? user.email : user.phone;
    if (channel === 'email') {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset OTP — Madina Bazar',
        text: `Your Madina Bazar password reset OTP is: ${otp}. Valid for 10 minutes. Do not share it.`,
        html: `<h2>Password Reset</h2><p>Your OTP is: <strong style="font-size:22px;letter-spacing:4px">${otp}</strong></p><p>Valid for 10 minutes. Do not share it with anyone.</p>`,
      });
    } else {
      await sendSMS({
        to: user.phone,
        message: `Madina Bazar: Your password reset OTP is ${otp}. Valid 10 min. Do not share.`,
      });
    }

    const out = {
      success: true,
      message: `OTP sent to your ${channel === 'email' ? 'email' : 'phone'}.`,
      channel,
      maskedTo: maskDestination(channel, sacred),
      expiresIn: OTP_TTL_MS / 1000,
    };
    // Local testing convenience only — never in production
    if (process.env.NODE_ENV !== 'production') out.devOTP = otp;
    res.status(200).json(out);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Verify reset OTP (step 2 of wizard)
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyResetOTP = async (req, res) => {
  try {
    const { email, phone, otp } = req.body;
    if (!(email || phone) || !otp) {
      return res.status(400).json({ success: false, message: 'Identifier and OTP are required' });
    }
    const { user } = await findByIdentifier(email || phone, true);
    const check = checkOTP(user, otp);
    if (!check.ok) {
      if (user && user.resetOTPHash) {
        user.resetOTPAttempts = (user.resetOTPAttempts || 0) + 1;
        await user.save({ validateBeforeSave: false });
      }
      return res.status(400).json({ success: false, message: check.message });
    }
    user.resetOTPVerified = true;
    user.resetOTPVerifiedExpire = new Date(Date.now() + OTP_TTL_MS);
    user.resetOTPHash = '';
    user.resetOTPExpire = undefined;
    user.resetOTPAttempts = 0;
    await user.save({ validateBeforeSave: false });
    res.status(200).json({ success: true, message: 'OTP verified. Set a new password.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Set new password after OTP verification
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { email, phone, otp, newPassword } = req.body;
    if (!(email || phone) || !newPassword) {
      return res.status(400).json({ success: false, message: 'Identifier and new password are required' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    const { user, channel } = await findByIdentifier(email || phone, true);
    if (!user || !user.isActive) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    let allowed = false;
    if (user.resetOTPVerified && user.resetOTPVerifiedExpire > new Date()) {
      allowed = true; // verified in step 2 within last 10 min
    } else if (otp) {
      const check = checkOTP(user, otp);
      if (!check.ok) {
        user.resetOTPAttempts = (user.resetOTPAttempts || 0) + 1;
        await user.save({ validateBeforeSave: false });
        return res.status(400).json({ success: false, message: check.message });
      }
      allowed = true;
    }
    if (!allowed) {
      return res.status(400).json({ success: false, message: 'OTP verification required' });
    }

    user.password = newPassword;
    user.resetOTPHash = '';
    user.resetOTPExpire = undefined;
    user.resetOTPAttempts = 0;
    user.resetOTPVerified = false;
    user.resetOTPVerifiedExpire = undefined;
    await user.save();

    // Confirmation (best effort)
    const note = 'Madina Bazar: Your password was just changed. If this was not you, contact support.';
    if (channel === 'email') {
      sendEmail({ to: user.email, subject: 'Password Changed — Madina Bazar', text: note }).catch(() => {});
    } else {
      sendSMS({ to: user.phone, message: note }).catch(() => {});
    }

    res.status(200).json({ success: true, message: 'Password reset successful. Please login.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// ---------- Social login (Google / Facebook) ----------

const isPlaceholderPhone = (phone) => !phone || /^(g|f)-/.test(String(phone));

// Verify Google ID token via tokeninfo endpoint (no extra dependency)
const verifyGoogleToken = async (idToken) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('Google login is not configured');
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.email) throw new Error(data.error_description || 'Invalid Google token');
  if (data.aud !== clientId) throw new Error('Google token audience mismatch');
  if (data.email_verified !== 'true' && data.email_verified !== true) {
    throw new Error('Google email is not verified');
  }
  return {
    providerId: data.sub,
    email: String(data.email).toLowerCase(),
    name: data.name || data.email.split('@')[0],
    avatar: data.picture || '',
  };
};

// Verify Facebook access token via debug_token + profile fetch
const verifyFacebookToken = async (accessToken) => {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) throw new Error('Facebook login is not configured');

  const debugRes = await fetch(
    `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`
  );
  const debug = await debugRes.json().catch(() => ({}));
  const d = debug.data || {};
  if (!d.is_valid || String(d.app_id) !== String(appId)) {
    throw new Error(d.error?.message || 'Invalid Facebook token');
  }

  const proof = crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');
  const meRes = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}&appsecret_proof=${proof}`
  );
  const me = await meRes.json().catch(() => ({}));
  if (!meRes.ok || !me.id || String(me.id) !== String(d.user_id)) {
    throw new Error(me.error?.message || 'Could not fetch Facebook profile');
  }
  if (!me.email) throw new Error('Facebook email permission is required. Please allow email access.');
  return {
    providerId: me.id,
    email: String(me.email).toLowerCase(),
    name: me.name || me.email.split('@')[0],
    avatar: me.picture?.data?.url || '',
  };
};

// @desc    Social login / signup (Google or Facebook, CUSTOMER only)
// @route   POST /api/auth/social
// @access  Public
export const socialAuth = async (req, res) => {
  try {
    const { provider, token } = req.body;
    if (!['google', 'facebook'].includes(provider) || !token) {
      return res.status(400).json({ success: false, message: 'Provider (google/facebook) and token are required' });
    }

    const profile =
      provider === 'google' ? await verifyGoogleToken(token) : await verifyFacebookToken(token);

    // Existing social link?
    let user =
      provider === 'google'
        ? await User.findOne({ googleId: profile.providerId })
        : await User.findOne({ facebookId: profile.providerId });

    // Link by verified email (or create new customer)
    if (!user) {
      user = await User.findOne({ email: profile.email });
      if (user) {
        if (user.role !== 'CUSTOMER') {
          return res.status(403).json({ success: false, message: 'This email belongs to a staff account. Please login with password.' });
        }
        if (provider === 'google') {
          user.googleId = profile.providerId;
          if (user.authProvider === 'local') user.authProvider = 'google';
        } else {
          user.facebookId = profile.providerId;
          if (user.authProvider === 'local') user.authProvider = 'facebook';
        }
        if (!user.avatar && profile.avatar) user.avatar = profile.avatar;
        await user.save({ validateBeforeSave: false });
      } else {
        user = await User.create({
          name: profile.name,
          email: profile.email,
          phone: `${provider[0]}-${profile.providerId}`, // placeholder until customer adds real number
          authProvider: provider,
          googleId: provider === 'google' ? profile.providerId : '',
          facebookId: provider === 'facebook' ? profile.providerId : '',
          avatar: profile.avatar || '',
          role: 'CUSTOMER',
        });
      }
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Your account has been disabled. Please contact admin.' });
    }

    const needsPhone = isPlaceholderPhone(user.phone);
    sendTokenResponse(user, 200, res, { isNewUser: false, needsPhone });
  } catch (error) {
    res.status(401).json({ success: false, message: error.message || 'Social login failed' });
  }
};

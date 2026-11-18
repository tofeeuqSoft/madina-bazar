import express from 'express';
import {
  register,
  login,
  logout,
  getMe,
  refreshToken,
  updateProfile,
  updatePassword,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  socialAuth,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { setup2fa, verify2fa, disable2fa, login2fa } from '../controllers/twoFactorController.js';

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.post('/refresh', authLimiter, refreshToken);
router.post('/social', authLimiter, socialAuth);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/verify-otp', authLimiter, verifyResetOTP);
router.post('/reset-password', authLimiter, resetPassword);

router.get('/me', protect, getMe);
router.post('/2fa/login', authLimiter, login2fa);
router.post('/2fa/setup', protect, setup2fa);
router.post('/2fa/verify', protect, verify2fa);
router.post('/2fa/disable', protect, disable2fa);
router.put('/profile', protect, updateProfile);
router.put('/update-password', protect, updatePassword);

export default router;

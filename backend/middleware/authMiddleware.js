import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { hasPermission } from '../utils/permissions.js';

// Protect routes - verify access token
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!req.user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is disabled. Contact admin.',
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token failed or expired',
    });
  }
};

// Role based authorization
// Usage: authorize('SUPER_ADMIN', 'ORDER_MANAGER')
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role (${req.user.role}) is not allowed to access this resource`,
      });
    }

    next();
  };
};

// Permission based authorization (recommended for most routes)
// Usage: checkPermission('PRODUCT_CREATE', 'PRODUCT_UPDATE')
export const checkPermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized',
      });
    }

    // Super Admin always passes
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    // Check if user has at least one of the required permissions
    const hasAccess = requiredPermissions.some((perm) =>
      hasPermission(req.user, perm)
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
        required: requiredPermissions,
      });
    }

    next();
  };
};

// Only staff (not customer)
export const adminOnly = (req, res, next) => {
  const staffRoles = [
    'SUPER_ADMIN',
    'SUB_ADMIN',
    'ORDER_MANAGER',
    'INVENTORY_MANAGER',
    'DELIVERY_MANAGER',
    'DELIVERY_RIDER',
    'ACCOUNTANT',
    'SUPPORT_MANAGER',
    'SUPPORT_AGENT',
    'DELIVERY_SUPPORT',
    'PAYMENT_SUPPORT',
    'REFUND_MANAGER',
    'AI_MANAGER',
  ];

  if (!req.user || !staffRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Admin access only',
    });
  }

  next();
};

// Super Admin only
export const superAdminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Super Admin access only',
    });
  }
  next();
};

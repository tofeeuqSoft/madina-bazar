import rateLimit from 'express-rate-limit';

// Parse int env with fallback
const num = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isSafeInteger(n) && n > 0 ? n : fallback;
};

// Consistent JSON response + RateLimit headers
const handler = (message) => (req, res, _next, options) => {
  res.status(options.statusCode).json({
    success: false,
    message,
    retryAfter: `${Math.ceil((options.windowMs || 15 * 60 * 1000) / 1000)}s`,
  });
};

// Skip health checks so monitoring / Docker HEALTHCHECK never gets blocked
const skipHealth = (req) => req.path === '/health' || req.originalUrl === '/api/health';

/**
 * General API limiter — applied to all /api routes.
 * Default: 200 requests / 15 min per IP
 */
export const apiLimiter = rateLimit({
  windowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: num(process.env.RATE_LIMIT_MAX, 200),
  standardHeaders: 'draft-7', // RateLimit-* headers
  legacyHeaders: false,
  skip: skipHealth,
  handler: handler('Too many requests, please try again later.'),
});

/**
 * Strict limiter for auth (login / register / refresh / password).
 * Default: 30 requests / 15 min per IP — brute-force protection.
 */
export const authLimiter = rateLimit({
  windowMs: num(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 15 * 60 * 1000),
  max: num(process.env.RATE_LIMIT_AUTH_MAX, 30),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: handler('Too many auth attempts, please try again later.'),
});

/**
 * Payment initiate limiter — prevents payment gateway abuse.
 * Default: 20 requests / 60 min per IP.
 */
export const paymentLimiter = rateLimit({
  windowMs: num(process.env.RATE_LIMIT_PAYMENT_WINDOW_MS, 60 * 60 * 1000),
  max: num(process.env.RATE_LIMIT_PAYMENT_MAX, 20),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: handler('Too many payment attempts, please try again later.'),
});

/**
 * Upload limiter — media uploads are expensive.
 * Default: 60 requests / 60 min per IP.
 */
export const uploadLimiter = rateLimit({
  windowMs: num(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS, 60 * 60 * 1000),
  max: num(process.env.RATE_LIMIT_UPLOAD_MAX, 60),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: handler('Too many uploads, please try again later.'),
});

/**
 * Search limiter — autocomplete / geocode / tracking hit paid third-party
 * APIs (Barikoi) or enable enumeration. Default: 60 requests / 15 min per IP.
 */
export const searchLimiter = rateLimit({
  windowMs: num(process.env.RATE_LIMIT_SEARCH_WINDOW_MS, 15 * 60 * 1000),
  max: num(process.env.RATE_LIMIT_SEARCH_MAX, 60),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: handler('Too many search requests, please try again later.'),
});

export default {
  apiLimiter,
  authLimiter,
  paymentLimiter,
  uploadLimiter,
  searchLimiter,
};

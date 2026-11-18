import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';

import path from 'path';
import { fileURLToPath } from 'url';

import connectDB from './config/db.js';
import { isCloudinaryConfigured } from './config/cloudinary.js';
import { staticUploadOptions, uploadsCacheMiddleware } from './middleware/mediaCache.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';
import { apiLimiter, searchLimiter } from './middleware/rateLimiter.js';

// Load env
dotenv.config();

// Connect Database
connectDB();

// Idempotency lock must exist before the first checkout: autoIndex builds in
// the background, so force-sync this one model (double-submit safety).
import('./models/IdempotencyKey.js')
  .then((m) => m.default.syncIndexes())
  .catch((e) => console.error('idempotency index sync:', e.message));

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Behind Nginx / Docker — needed for correct client IP in rate limiter
app.set('trust proxy', 1);

// Security & Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow non-browser / same-origin requests
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Allow any localhost port in development
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
}));
app.use(express.json({
  limit: '15mb',
  // Keep raw body for HMAC webhook signature verification
  verify: (req, res, buf) => {
    if (req.originalUrl?.startsWith('/api/webhooks/')) req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(cookieParser());
// NoSQL injection guard: strips $ and . keys from req.body/query/params
app.use(mongoSanitize());
// HTTP Parameter Pollution guard
app.use(hpp());
// Basic XSS guard: neutralize <script> payloads in string fields
app.use((req, res, next) => {
  const clean = (v) => {
    if (typeof v === 'string') return v.replace(/<\s*script[^>]*>.*?<\s*\/\s*script\s*>/gis, '').replace(/javascript\s*:/gi, '');
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) v[k] = clean(v[k]);
    }
    return v;
  };
  if (req.body) req.body = clean(req.body);
  next();
});
if (typeof compression === 'function') app.use(compression({ threshold: 1024 }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Media CDN-style cache for local uploads
app.use('/uploads', uploadsCacheMiddleware);
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), staticUploadOptions));

// Rate Limiting — general guard for all /api routes (health check skipped inside)
app.use('/api', apiLimiter);

// Static files (uploads)

// Routes will be imported here
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import productRoutes from './routes/productRoutes.js';
import comboRoutes from './routes/comboRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import deliveryAreaRoutes from './routes/deliveryAreaRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import groceryZoneRoutes from './routes/groceryZoneRoutes.js';
import addressRoutes from './routes/addressRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import accountingRoutes from './routes/accountingRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import returnRoutes from './routes/returnRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import orderAdminRoutes from './routes/orderAdminRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import deliveryAdminRoutes from './routes/deliveryAdminRoutes.js';
import marketingRoutes from './routes/marketingRoutes.js';
import { courierWebhook, publicTracking } from './controllers/deliveryAdminController.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initSupportSocket } from './socket/supportSocket.js';
import { startWorker } from './services/jobQueue.js';
import { registerDeliveryJobs } from './services/delivery/deliveryJobs.js';
import logger from './utils/logger.js';
import { swaggerUiServe, swaggerUiSetup } from './utils/swagger.js';

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/combos', comboRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/delivery-areas', deliveryAreaRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/grocery-zones', groceryZoneRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/admin/orders', orderAdminRoutes);
app.use('/api/admin/inventory', inventoryRoutes);
app.use('/api/admin/delivery', deliveryAdminRoutes);
app.use('/api/admin/marketing', marketingRoutes);
// Courier webhooks are PUBLIC (provider-signed) — idempotency protected inside
app.post('/api/webhooks/courier/:provider', courierWebhook);
// Public order tracking (order number + phone verification, masked output)
app.post('/api/track', searchLimiter, publicTracking);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Madina Bazar API is running', timestamp: new Date() });
});

// API reference
app.use('/api/docs', swaggerUiServe, swaggerUiSetup);

// Detailed health (for monitoring/alerting)
app.get('/api/health/detailed', async (req, res) => {
  const mongoose = (await import('mongoose')).default;
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    success: true,
    timestamp: new Date(),
    uptimeSec: Math.round(process.uptime()),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    db: states[mongoose.connection.readyState] || 'unknown',
    env: process.env.NODE_ENV || 'development',
  });
});

// Error Handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (isCloudinaryConfigured()) {
  console.log('☁️  Cloudinary: enabled');
} else {
  console.log('📁 Media: local /uploads (set CLOUDINARY_* for cloud)');
}
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins.length ? allowedOrigins : true, credentials: true },
});
initSupportSocket(io);
// Persistent job worker (courier retries, tracking sync — survives restarts)
registerDeliveryJobs();
startWorker({ intervalMs: Number(process.env.WORKER_INTERVAL_MS) || 15000 });
// In-process scheduler (expiry, alerts, capacity hints)
import('./utils/scheduler.js').then((m) => m.startScheduler()).catch((e) => console.error('scheduler', e.message));
logger.info('Background worker + scheduler starting');
httpServer.listen(PORT, () => {
  console.log(`🚀 Madina Bazar Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

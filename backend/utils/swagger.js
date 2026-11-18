import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Madina Bazar API',
      version: '1.0.0',
      description: 'E-commerce platform API — auth (httpOnly cookies), orders, delivery network, inventory, support. Full human-readable reference; validation rules live in controllers.',
    },
    servers: [{ url: '/api', description: 'Same origin' }],
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'accessToken' },
      },
      schemas: {
        Error: { type: 'object', properties: { success: { type: 'boolean', example: false }, message: { type: 'string' }, code: { type: 'string' } } },
        Order: { type: 'object', properties: { orderNumber: { type: 'string' }, orderStatus: { type: 'string' }, totalAmount: { type: 'number' } } },
        Shipment: { type: 'object', properties: { shipmentNo: { type: 'string' }, deliveryMode: { type: 'string', enum: ['OWN_DELIVERY', 'EXTERNAL_COURIER'] }, status: { type: 'string' } } },
      },
    },
    paths: {
      '/health': { get: { summary: 'Health check', responses: { 200: { description: 'OK' } } } },
      '/track': { post: { summary: 'Public order tracking (order number + phone)', responses: { 200: { description: 'Tracking info' }, 403: { description: 'Phone mismatch' } } } },
      '/auth/login': { post: { summary: 'Login (httpOnly cookies set). Returns requires2fa when TOTP enabled', responses: { 200: { description: 'Session or 2FA challenge' } } } },
      '/auth/2fa/login': { post: { summary: 'Complete login with authenticator code', responses: { 200: { description: 'Session' } } } },
      '/orders': { post: { summary: 'Checkout (stock deducted atomically)', security: [{ cookieAuth: [] }], responses: { 201: { description: 'Order created' }, 400: { description: 'INSUFFICIENT_STOCK' } } } },
      '/returns/request': { post: { summary: 'Customer return request (own delivered orders)', security: [{ cookieAuth: [] }], responses: { 201: { description: 'Requested' } } } },
      '/support/tickets': {
        get: { summary: 'List tickets (customers see own only)', security: [{ cookieAuth: [] }], responses: { 200: { description: 'OK' } } },
        post: { summary: 'Create ticket', security: [{ cookieAuth: [] }], responses: { 201: { description: 'Created' } } },
      },
      '/admin/orders/dashboard': { get: { summary: 'Order KPIs', security: [{ cookieAuth: [] }], responses: { 200: { description: 'OK' } } } },
      '/admin/inventory/dashboard': { get: { summary: 'Inventory KPIs', security: [{ cookieAuth: [] }], responses: { 200: { description: 'OK' } } } },
      '/admin/delivery/dashboard': { get: { summary: 'Delivery network KPIs', security: [{ cookieAuth: [] }], responses: { 200: { description: 'OK' } } } },
      '/admin/delivery/shipments': { get: { summary: 'List shipments', security: [{ cookieAuth: [] }], responses: { 200: { description: 'OK' } } } },
      '/webhooks/courier/{provider}': { post: { summary: 'Courier webhook (HMAC + idempotent)', parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Processed' } } } },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
export const swaggerUiServe = swaggerUi.serve;
export const swaggerUiSetup = swaggerUi.setup(swaggerSpec, { customSiteTitle: 'Madina Bazar API Docs' });

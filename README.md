# Madina Bazar - Complete E-Commerce Platform

**Domain:** www.madinabazae.com  
**Stack:** MERN (MongoDB + Express + React + Node.js)  
**Features:** Multi-role Admin, Dynamic Categories, Combo Packs, Delivery Areas, Barikoi API, Multiple Payments

## Project Structure

```
madina-bazar/
├── backend/
│   ├── config/
│   ├── controllers/
│   │   └── authController.js      ✅
│   ├── models/                    ✅ All models ready
│   ├── routes/
│   │   └── authRoutes.js          ✅
│   ├── middleware/
│   │   ├── authMiddleware.js      ✅ Protect + Authorize + Permission
│   │   └── errorMiddleware.js     ✅
│   ├── utils/
│   │   ├── generateToken.js       ✅ JWT Access + Refresh
│   │   └── seed.js                ✅ Super Admin + Roles seeder
│   └── server.js
├── frontend/                      (coming soon)
└── docs/
```

## Current Progress

### ✅ Completed
- [x] Project Structure
- [x] Backend Foundation (Express + Security)
- [x] All Database Models
- [x] **Authentication System**
  - Register (Customer)
  - Login (Email or Phone)
  - Logout
  - Get Me
  - Refresh Token
  - Update Password
  - JWT Access Token (15m) + Refresh Token (7d)
  - HTTP-only Cookies
- [x] **Role & Permission Middleware**
  - `protect` – JWT verification
  - `authorize(...roles)` – Role based
  - `checkPermission(...perms)` – Permission based
  - `adminOnly` – Staff only
- [x] Super Admin + Roles Seeder

### 🔄 Next Recommended Steps
1. Category Module (CRUD + Nested)
2. Product Module
3. User Management (Admin side)
4. Delivery Area Module
5. ... continue

## How to Run

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Make sure MongoDB is running
```bash
# Local MongoDB should be running on 27017
```

### 3. Seed Super Admin & Roles
```bash
npm run seed
```

### 4. Start Server
```bash
npm run dev
```

Server → `http://localhost:5000`

### Default Super Admin
- **Email:** `admin@madinabazar.com`
- **Phone:** `01700000000`
- **Password:** `Admin@123456`  
⚠️ Change password after first login!

## Auth API Endpoints

| Method | Endpoint                  | Access  | Description              |
|--------|---------------------------|---------|--------------------------|
| POST   | /api/auth/register        | Public  | Customer registration    |
| POST   | /api/auth/login           | Public  | Login (email or phone)   |
| POST   | /api/auth/logout          | Public  | Logout                   |
| POST   | /api/auth/refresh         | Public  | Refresh access token     |
| GET    | /api/auth/me              | Private | Get current user         |
| PUT    | /api/auth/update-password | Private | Change password          |

## User Roles
1. SUPER_ADMIN  
2. SUB_ADMIN  
3. ORDER_MANAGER  
4. INVENTORY_MANAGER  
5. DELIVERY_MANAGER  
6. DELIVERY_RIDER  
7. ACCOUNTANT  
8. CUSTOMER  

---
**Madina Bazar** – Grocery & Ready-to-Cook for Mirpur (expanding to Dhaka)

---

## RBAC System (Role Based Access Control)

### Available Middleware

| Middleware | Usage | Description |
|------------|-------|-------------|
| `protect` | All private routes | JWT verification |
| `authorize('ROLE1', 'ROLE2')` | Role check | Only specific roles |
| `checkPermission('PERM1')` | Permission check | Granular permission |
| `adminOnly` | Staff routes | All staff except customer |
| `superAdminOnly` | Critical routes | Only Super Admin |

### Permission Examples

```js
// Only Super Admin
router.post('/staff', protect, superAdminOnly, createStaff);

// Order Manager or Super Admin
router.get('/orders', protect, authorize('SUPER_ADMIN', 'ORDER_MANAGER'), getOrders);

// Anyone with PRODUCT_CREATE permission
router.post('/products', protect, checkPermission('PRODUCT_CREATE'), createProduct);
```

### Key APIs

**Roles**
- `GET    /api/roles`
- `POST   /api/roles`
- `PUT    /api/roles/:id`
- `GET    /api/roles/permissions/list`

**Users / Staff**
- `GET    /api/users`
- `POST   /api/users/staff`
- `PUT    /api/users/:id`
- `PUT    /api/users/:id/permissions`
- `PATCH  /api/users/:id/status`
- `DELETE /api/users/:id`

---

## Category System

### Features
- Unlimited nested categories (Category → Sub → Child)
- Enable / Disable
- Display Order
- Slug based URL
- Tree structure API

### API Endpoints

| Method | Endpoint                    | Access     | Description              |
|--------|-----------------------------|------------|--------------------------|
| GET    | /api/categories             | Public     | Flat list                |
| GET    | /api/categories/tree        | Public     | Nested tree              |
| GET    | /api/categories/:id         | Public     | Single category + children |
| POST   | /api/categories             | Private    | Create (CATEGORY_CREATE) |
| PUT    | /api/categories/:id         | Private    | Update                   |
| PATCH  | /api/categories/:id/status  | Private    | Enable/Disable           |
| DELETE | /api/categories/:id         | Private    | Delete                   |

### Seed Sample Categories
```bash
npm run seed:categories
```

---

## Product System

### Features
- Full CRUD
- Stock Management (set / increment / decrement)
- Low Stock Alert
- Multiple Images
- Unit System (KG, Gram, Piece, Packet, Liter, ML, Box, Dozen)
- Regular Price + Sale Price
- Category + Subcategory
- Product Type (GROCERY, READY_TO_COOK, COMBO, OTHER)
- Featured Products
- Search + Filter + Pagination

### API Endpoints

| Method | Endpoint                         | Access              | Description            |
|--------|----------------------------------|---------------------|------------------------|
| GET    | /api/products                    | Public              | List + filters         |
| GET    | /api/products/:id                | Public              | Single product         |
| GET    | /api/products/inventory/low-stock| Private             | Low stock list         |
| POST   | /api/products                    | PRODUCT_CREATE      | Create                 |
| PUT    | /api/products/:id                | PRODUCT_UPDATE      | Update                 |
| PATCH  | /api/products/:id/stock          | INVENTORY_UPDATE    | Update stock           |
| PATCH  | /api/products/:id/status         | PRODUCT_STATUS      | Enable/Disable         |
| DELETE | /api/products/:id                | PRODUCT_DELETE      | Delete                 |

### Query Filters (GET /api/products)
- `category`, `subcategory`, `productType`, `brand`
- `search`, `minPrice`, `maxPrice`
- `inStock=true/false`, `isFeatured=true`
- `isActive=true/false`
- `sort`, `page`, `limit`

---

## Combo Pack System

### Features
- Multiple products with quantity
- Regular Price / Sale Price / Discount
- Enable / Disable
- Featured Combos
- Product population with stock info

### API Endpoints

| Method | Endpoint                  | Access         | Description     |
|--------|---------------------------|----------------|-----------------|
| GET    | /api/combos               | Public         | List combos     |
| GET    | /api/combos/:id           | Public         | Single combo    |
| POST   | /api/combos               | COMBO_CREATE   | Create combo    |
| PUT    | /api/combos/:id           | COMBO_UPDATE   | Update combo    |
| PATCH  | /api/combos/:id/status    | COMBO_UPDATE   | Enable/Disable  |
| DELETE | /api/combos/:id           | COMBO_DELETE   | Delete combo    |

### Example Create Body
```json
{
  "name": "Family Grocery Combo",
  "items": [
    { "product": "PRODUCT_ID_1", "quantity": 1 },
    { "product": "PRODUCT_ID_2", "quantity": 2 }
  ],
  "regularPrice": 1500,
  "salePrice": 1299,
  "discount": 13,
  "description": "Monthly essential combo",
  "isFeatured": true
}
```

---

## Delivery Area System

### Features
- Dynamic Area management
- Enable / Disable areas
- Delivery Charge per area
- Minimum Order Amount
- Estimated Delivery Time
- Nested area support (parent → child)
- Availability check for checkout
- Barikoi ready field

### Current Launch Plan
- **Phase 1**: Mirpur Only (Active)
- **Phase 2**: Mohammadpur, Dhanmondi
- **Phase 3**: Entire Dhaka

### API Endpoints

| Method | Endpoint                        | Access                    | Description              |
|--------|---------------------------------|---------------------------|--------------------------|
| GET    | /api/delivery-areas             | Public                    | All areas                |
| GET    | /api/delivery-areas/active      | Public                    | Only active areas        |
| GET    | /api/delivery-areas/:id         | Public                    | Single area              |
| POST   | /api/delivery-areas/check       | Public                    | Check availability       |
| POST   | /api/delivery-areas             | DELIVERY_AREA_CREATE      | Create area              |
| PUT    | /api/delivery-areas/:id         | DELIVERY_AREA_UPDATE      | Update area              |
| PATCH  | /api/delivery-areas/:id/status  | DELIVERY_AREA_DISABLE     | Enable/Disable           |
| DELETE | /api/delivery-areas/:id         | SUPER_ADMIN               | Delete area              |

### Seed Initial Areas
```bash
npm run seed:delivery
```

---

## Cart & Wishlist System

### Cart Features
- Add Product / Combo
- Update Quantity
- Remove Item
- Clear Cart
- Stock validation
- Auto calculate subtotal

### Wishlist Features
- Add / Remove Product
- Check if in wishlist
- Clear Wishlist

### API Endpoints

**Cart**
| Method | Endpoint              | Description        |
|--------|-----------------------|--------------------|
| GET    | /api/cart             | Get cart           |
| POST   | /api/cart             | Add to cart        |
| PUT    | /api/cart/:itemId     | Update quantity    |
| DELETE | /api/cart/:itemId     | Remove item        |
| DELETE | /api/cart             | Clear cart         |

**Wishlist**
| Method | Endpoint                        | Description           |
|--------|---------------------------------|-----------------------|
| GET    | /api/wishlist                   | Get wishlist          |
| POST   | /api/wishlist                   | Add to wishlist       |
| GET    | /api/wishlist/check/:productId  | Check if in wishlist  |
| DELETE | /api/wishlist/:productId        | Remove from wishlist  |
| DELETE | /api/wishlist                   | Clear wishlist        |

> Note: Guest cart should be handled in Frontend (localStorage) and can be merged after login.

---

## Order System

### Order Status Flow
```
Pending → Confirmed → Processing → Ready for Delivery → Out for Delivery → Delivered
                ↘
              Cancelled
```

### Payment Status (Separate)
`Pending` | `Paid` | `Failed` | `Refunded`

### Features
- Create Order from Cart
- Stock reduction on order
- Stock restore on cancel
- Coupon support
- Delivery Area validation
- Minimum order amount check
- Status History
- Rider Assignment
- Customer cancel (only Pending)

### API Endpoints

| Method | Endpoint                      | Access              | Description              |
|--------|-------------------------------|---------------------|--------------------------|
| POST   | /api/orders                   | Customer            | Create order (Checkout)  |
| GET    | /api/orders/my-orders         | Customer            | Own orders               |
| GET    | /api/orders/:id               | Owner / Staff       | Single order             |
| GET    | /api/orders                   | ORDER_VIEW          | All orders (Admin)       |
| PATCH  | /api/orders/:id/status        | ORDER_UPDATE        | Update status            |
| PATCH  | /api/orders/:id/cancel        | Customer            | Cancel own order         |
| PATCH  | /api/orders/:id/assign-rider  | ORDER_ASSIGN_RIDER  | Assign delivery rider    |

---

## Coupon System

### Features
- Percentage or Fixed discount
- Minimum order amount
- Maximum discount cap
- Expiry date
- Usage limit
- Enable / Disable
- Validate before checkout

### API Endpoints

| Method | Endpoint                    | Access         | Description           |
|--------|-----------------------------|----------------|-----------------------|
| POST   | /api/coupons/validate       | Private        | Validate coupon       |
| GET    | /api/coupons                | COUPON_VIEW    | All coupons           |
| GET    | /api/coupons/:id            | COUPON_VIEW    | Single coupon         |
| POST   | /api/coupons                | COUPON_CREATE  | Create coupon         |
| PUT    | /api/coupons/:id            | COUPON_UPDATE  | Update coupon         |
| PATCH  | /api/coupons/:id/status     | COUPON_UPDATE  | Enable/Disable        |
| DELETE | /api/coupons/:id            | COUPON_DELETE  | Delete coupon         |

### Example Create
```json
{
  "code": "WELCOME10",
  "discountType": "percentage",
  "discountValue": 10,
  "minimumOrderAmount": 500,
  "maximumDiscount": 100,
  "expiryDate": "2026-12-31",
  "usageLimit": 1000
}
```

---

## Settings & Payment

### Settings API
| Method | Endpoint              | Access           | Description        |
|--------|-----------------------|------------------|--------------------|
| GET    | /api/settings         | Public           | Public settings    |
| GET    | /api/settings/admin   | SETTINGS_VIEW    | Full settings      |
| PUT    | /api/settings         | SETTINGS_UPDATE  | Update settings    |

### Payment API (Placeholder)
| Method | Endpoint                        | Access              | Description              |
|--------|---------------------------------|---------------------|--------------------------|
| POST   | /api/payments/initiate          | Customer            | Start payment            |
| PATCH  | /api/payments/:orderId/status   | PAYMENT_VIEW        | Update payment status    |

> Real bKash / Nagad / SSLCommerz integration will be added later with merchant credentials.

---

## Backend Completion Status

| Module                    | Status |
|---------------------------|--------|
| Project Setup             | ✅     |
| Auth + JWT + RBAC         | ✅     |
| Category (Nested)         | ✅     |
| Product + Inventory       | ✅     |
| Combo Pack                | ✅     |
| Delivery Area             | ✅     |
| Cart & Wishlist           | ✅     |
| Order System              | ✅     |
| Coupon                    | ✅     |
| Settings                  | ✅     |
| Payment (Placeholder)     | ✅     |

**Backend Core is ready.**

Next major step → **Frontend (React + Vite + Tailwind)**

---

## Frontend (React + Vite + Tailwind)

### Structure
```
frontend/
├── src/
│   ├── components/layout/   # Header, Footer, Layout
│   ├── pages/               # Home, Login, Register, Shop...
│   ├── services/api.js      # Axios instance
│   ├── store/authStore.js   # Zustand auth
│   └── App.jsx
├── tailwind.config.js
└── vite.config.js
```

### Run Frontend
```bash
cd frontend
npm install
npm run dev
```
→ http://localhost:5173

### Current Frontend Pages
- ✅ Home (Hero + Categories)
- ✅ Login (Email / Phone)
- ✅ Register
- ✅ Header + Footer + Layout
- ⏳ Shop, Product, Cart, Checkout, Admin (next)

---

## Customer Frontend Completed

| Page / Feature              | Status |
|-----------------------------|--------|
| Home                        | ✅     |
| Shop (Filter + Pagination)  | ✅     |
| Product Details             | ✅     |
| Add to Cart                 | ✅     |
| Cart Page                   | ✅     |
| Checkout (COD)              | ✅     |
| Login / Register            | ✅     |
| Header Cart Count           | ✅     |
| Guest Cart (localStorage)   | ✅     |

### Run Everything
```bash
# Backend
cd backend && npm install && npm run seed && npm run seed:categories && npm run seed:delivery && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:5000

### Still Pending (can continue later)
- My Orders page (full)
- Wishlist page
- Admin Panel UI
- Real bKash/Nagad payment
- Invoice PDF
- Barikoi map integration

### Customer Pages (Updated)
| Page            | Status |
|-----------------|--------|
| My Orders       | ✅     |
| Order Details   | ✅     |
| Cancel Order    | ✅     |
| Wishlist        | ✅     |

---

## Admin Panel

| Feature                    | Status |
|----------------------------|--------|
| Admin Layout + Sidebar     | ✅     |
| Role-based Access Guard    | ✅     |
| Dashboard (Stats + Recent) | ✅     |
| Orders Management + Status | ✅     |
| Products List + Toggle/Delete | ✅  |
| Categories / Combos / etc. | ⏳ Placeholder |

### Access Admin
Login as Super Admin → http://localhost:5173/admin

Default: `admin@madinabazar.com` / `Admin@123456`

---

## ✅ Project Status — Major Completion

### Backend
- Auth, RBAC, JWT
- Categories, Products, Combos
- Cart, Wishlist, Orders
- Delivery Areas, Coupons
- Settings, Payment placeholder

### Customer Frontend
- Home, Shop, Product Details
- Cart, Checkout (COD)
- My Orders, Order Details, Wishlist
- Login / Register

### Admin Panel
- Dashboard
- Orders management
- Products CRUD
- Categories (nested)
- Delivery Areas
- Coupons
- Combos
- Users
- Settings

### Still optional later
- Real bKash / Nagad / SSLCommerz
- Barikoi map
- Invoice PDF
- Image upload (cloud storage)
- Email/SMS notifications

---

## Payment Integration (bKash + Nagad)

### Flow
1. Customer places order with BKASH or NAGAD
2. Backend creates payment via gateway API
3. Customer redirected to bKash / Nagad app/web
4. Callback hits backend → Execute/Verify → mark Paid
5. Customer redirected to `/payment/success` or `/payment/failed`

### Environment (backend `.env`)
```env
CLIENT_URL=http://localhost:5173
API_URL=http://localhost:5000

# bKash (sandbox or live)
BKASH_SANDBOX=true
BKASH_USERNAME=your_username
BKASH_PASSWORD=your_password
BKASH_APP_KEY=your_app_key
BKASH_APP_SECRET=your_app_secret

# Nagad
NAGAD_SANDBOX=true
NAGAD_MERCHANT_ID=your_merchant_id
NAGAD_MERCHANT_NUMBER=01XXXXXXXXX
NAGAD_MERCHANT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
NAGAD_PG_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

### Admin
Settings → enable **bKash** / **Nagad** toggles after credentials are set.

### API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments/gateways` | Which methods enabled+configured |
| POST | `/api/payments/initiate` | Start COD/bKash/Nagad |
| GET | `/api/payments/bkash/callback` | bKash redirect callback |
| GET | `/api/payments/nagad/callback` | Nagad redirect callback |

> Get merchant credentials from bKash Merchant Portal and Nagad Merchant Portal. Use sandbox for testing first.

---

## SSLCommerz + Invoice

### SSLCommerz
```env
SSLCOMMERZ_LIVE=false
SSLCOMMERZ_STORE_ID=your_store_id
SSLCOMMERZ_STORE_PASSWORD=your_store_password
```
Enable in Admin → Settings → SSLCommerz.

Supports cards, mobile banking, etc. via hosted checkout + IPN validation.

### Invoice
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices/:orderId` | JSON invoice |
| GET | `/api/invoices/:orderId/print` | Printable HTML |

Customer: My Orders → Order Details → **Print Invoice**

---

## Barikoi Address Search

### Backend
```env
BARIKOI_API_KEY=your_barikoi_api_key
```
Get key: https://barikoi.com

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/location/status` | Configured? |
| GET | `/api/location/autocomplete?q=` | Address suggestions |
| GET | `/api/location/reverse?lat=&lng=` | Reverse geocode |

### Frontend
Checkout → **Search Address (Barikoi)** autocomplete  
Selected place fills address + lat/lng/placeId for the order.

---

## Image Upload

### Modes
1. **Local** (default): files saved to `backend/uploads/` served at `/uploads/...`
2. **Cloudinary** (optional): set env vars → auto-upload to cloud

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=madina-bazar
```

### API
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Single image (`multipart` field: `image`) |
| POST | `/api/upload/multiple` | Up to 10 images (`images`) |
| GET | `/api/upload/status` | Local / Cloudinary status |

### Admin UI
- Products → Upload Images button
- Categories → Upload button next to image URL

Max 5MB · jpeg, png, webp, gif

---

## Notifications (Email + SMS)

### When sent
- **Order placed** → SMS + Email to customer
- **Order status change** → SMS + Email (Confirmed, Out for Delivery, Delivered, etc.)

Without credentials, messages are **logged to console** (safe for local dev).

### Email (SMTP)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=app_password
SMTP_FROM="Madina Bazar <noreply@madinabazar.com>"
```
```bash
npm install nodemailer
```

### SMS options
**Twilio**
```env
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=+1...
```

**Generic BD API** (BulkSMSBD / similar)
```env
SMS_API_URL=https://provider.example/api/send
SMS_API_KEY=...
SMS_SENDER_ID=MadinaBazar
```

### API
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/notifications/status` | Public |
| POST | `/api/notifications/test` | Admin — `{ type: "sms"|"email", to, message }` |

---

## Deployment

Full guide: **[deploy/DEPLOY.md](./deploy/DEPLOY.md)**

Quick stack:
- Ubuntu VPS + Nginx + PM2 + MongoDB
- SSL via Certbot
- Frontend: `npm run build` → Nginx static
- Backend: `pm2 start ecosystem.config.cjs`

Config samples:
- `backend/ecosystem.config.cjs` — PM2
- `deploy/nginx-madinabazar.conf` — Nginx

---

## Deployment

Full guide: **[deploy/DEPLOY.md](./deploy/DEPLOY.md)**

Quick stack:
- Ubuntu VPS
- Nginx (frontend `dist` + `/api` proxy)
- PM2 (`backend/ecosystem.config.cjs`)
- Certbot SSL
- MongoDB local or Atlas

```bash
# On server (summary)
cd backend && npm i --production && pm2 start ecosystem.config.cjs --env production
cd ../frontend && npm i && npm run build
# Configure Nginx from deploy/nginx-madinabazar.conf
sudo certbot --nginx -d yourdomain.com
```

---

## Docker

```bash
docker compose up -d --build
docker compose exec backend node utils/seed.js
```

See **[deploy/DOCKER.md](./deploy/DOCKER.md)**

---

## CI/CD (GitHub Actions)

| Workflow | Role |
|----------|------|
| `ci.yml` | Lint/syntax + frontend build + Docker build |
| `cd-vps.yml` | Deploy to VPS over SSH |
| `cd-docker-hub.yml` | Push images on version tags |

Docs: **[deploy/CICD.md](./deploy/CICD.md)**

### Secrets (for deploy)
`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, optional `VPS_DEPLOY_PATH`  
Docker: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`

---

## Accounting Management System

Double-entry–ready ledger engine. Every financial event auto-posts balanced journals; statements read posted journals only.

### Flow
```
Order Confirmed → Sale journal (Dr Receivable / Cr Sales+Delivery+Tax) + COGS (Dr COGS / Cr Inventory)
Payment (COD delivered / gateway / manual verify) → Dr Asset / Cr Receivable (+ gateway fee legs)
Cancel after payment → auto Return (Refunded) + reversal (Dr Sales Returns / Cr Asset)
Expense → Dr Expense / Cr Cash·Bank·bKash | Void → mirror reversal (no hard delete, ever)
Purchase receive → Dr Inventory / Cr Payable + Cash | Supplier pay → Dr Payable / Cr Cash (delta-aware)
Transfer → Dr To / Cr From
```

### Key rules
- **Immutable history**: order snapshots (price/cost/tax), no hard deletes (products/expenses/purchases/returns → 403, void/reject instead)
- **Idempotent postings**: `refKey` unique per (module:ref:kind); verify/repair safe to retry
- **Server-side amounts only**: frontend charges never trusted — delivery/tax recomputed at order time
- **Standalone-Mongo safety**: ordered writes (journal-first), failures audit-logged, `POST /api/accounting/repair` backfills; use replica-set transactions in production for multi-doc atomicity
- **Configurable**: tax rate, gateway fees %, payment methods, expense categories, fiscal year — all in Accounting → Settings (nothing hard-coded)

### API (`/api/accounting`, JWT + ACCOUNTING_VIEW / ACCOUNTING_MANAGE)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard?preset=today\|yesterday\|week\|month\|lastMonth\|year` + custom `from&to` | KPIs + charts |
| GET | `/sales` | Summary + order rows (paid/due/UNPAID…REFUNDED) |
| GET/POST | `/payments` | List / record manual (PENDING) |
| PATCH | `/payments/:id/verify` | Approve → posts journals + order paid |
| PATCH | `/payments/:id/fail` | Mark FAILED/CANCELLED |
| GET | `/ledger?account&ref&from&to` | Ledger lines + running balances |
| GET | `/journals?module&status` | Journal vouchers + legs |
| PATCH | `/journals/:id/void` | Void via mirror reversal |
| GET | `/trial-balance` | Dr = Cr proof (void pairs excluded) |
| GET | `/profit-loss`, `/cash-flow`, `/tax` | Audited statements |
| GET | `/customers`, `/customers/:id` | Receivable + history |
| GET | `/suppliers/:id` | Payable + payment history + journals |
| GET/POST/PUT | `/accounts`, `/accounts/:code/txns`, `/transfer` | Cash & bank |
| GET | `/delivery` | Delivery revenue/expense/margin |
| GET/PUT | `/settings` | Chart of accounts, tax, fees, methods, categories |
| POST | `/repair` | Backfill missing journals (idempotent) |

Plus existing flows post automatically: expenses `POST /expenses`, purchases `POST /purchases` + `PATCH /purchases/:id/payment`, returns `PATCH /returns/:id/status`, expense void `PATCH /expenses/:id/void`.

### Frontend
Admin → **Accounting** group: Dashboard, Sales & Orders, Payments, Expenses, Purchases, Refunds, Customers, Cash & Bank, Ledger, Statements (P&L/Cash Flow/Tax), Reports (CSV), Settings. All lists: search/filter/pagination/date-range/export. Mobile-first responsive.

### Chart of Accounts (seeded, extendable)
Assets: CASH, BANK, BKASH, NAGAD, GATEWAY, ACC_RECEIVABLE, INVENTORY · Liabilities: ACC_PAYABLE, SUPPLIER_PAYABLE, TAX_PAYABLE · Equity: OWNER_EQUITY · Revenue: SALES_REVENUE, DELIVERY_REVENUE, OTHER_REVENUE, SALES_RETURNS (contra) · Expenses: COGS, DELIVERY, MARKETING, SALARY, RENT, UTILITY, GATEWAY_FEE, PACKAGING, OTHER.
#   m a d i n a - b a z a r  
 
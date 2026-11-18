import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import CustomerLayout from './components/layout/CustomerLayout';
import AdminRoute from './components/admin/AdminRoute';
import RequirePerm from './components/admin/RequirePerm';
import RiderRoute from './components/rider/RiderRoute';

// Eager: shell only
const Home = lazy(() => import('./pages/Home'));
const Shop = lazy(() => import('./pages/Shop'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetails = lazy(() => import('./pages/OrderDetails'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const PaymentResult = lazy(() => import('./pages/PaymentResult'));
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Track = lazy(() => import('./pages/Track'));
const Faq = lazy(() => import('./pages/Faq'));

const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminOrders = lazy(() => import('./pages/admin/Orders'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const ProductForm = lazy(() => import('./pages/admin/ProductForm'));
const AdminCategories = lazy(() => import('./pages/admin/Categories'));
const AdminDeliveryAreas = lazy(() => import('./pages/admin/DeliveryAreas'));
const GroceryZones = lazy(() => import('./pages/admin/GroceryZones'));
const Nationwide = lazy(() => import('./pages/admin/Nationwide'));
const FreeDelivery = lazy(() => import('./pages/admin/FreeDelivery'));
const DeliveryAnalytics = lazy(() => import('./pages/admin/DeliveryAnalytics'));
const AuditLog = lazy(() => import('./pages/admin/AuditLog'));
const AccDashboard = lazy(() => import('./pages/admin/accounting/AccDashboard'));
const AccSales = lazy(() => import('./pages/admin/accounting/AccSales'));
const AccPayments = lazy(() => import('./pages/admin/accounting/AccPayments'));
const AccExpenses = lazy(() => import('./pages/admin/accounting/AccExpenses'));
const AccPurchases = lazy(() => import('./pages/admin/accounting/AccPurchases'));
const AccRefunds = lazy(() => import('./pages/admin/accounting/AccRefunds'));
const AccCustomers = lazy(() => import('./pages/admin/accounting/AccCustomers'));
const AccCashBank = lazy(() => import('./pages/admin/accounting/AccCashBank'));
const AccLedger = lazy(() => import('./pages/admin/accounting/AccLedger'));
const AccStatements = lazy(() => import('./pages/admin/accounting/AccStatements'));
const AccDelivery = lazy(() => import('./pages/admin/accounting/AccDelivery'));
const AccReports = lazy(() => import('./pages/admin/accounting/AccReports'));
const AccSettings = lazy(() => import('./pages/admin/accounting/AccSettings'));
const AdminCoupons = lazy(() => import('./pages/admin/Coupons'));
const AdminCombos = lazy(() => import('./pages/admin/Combos'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const AdminReports = lazy(() => import('./pages/admin/Reports'));
// Customer Support (AI-ready, human-operated)
const SupportDashboard = lazy(() => import('./pages/admin/support/SupportDashboard'));
const SupportAI = lazy(() => import('./pages/admin/support/AIAssistant'));
const SupportChat = lazy(() => import('./pages/admin/support/LiveChat'));
const SupportTickets = lazy(() => import('./pages/admin/support/Tickets'));
const SupportTicketDetails = lazy(() => import('./pages/admin/support/TicketDetails'));
const SupportConversations = lazy(() => import('./pages/admin/support/Conversations'));
const SupportCustomer360 = lazy(() => import('./pages/admin/support/Customer360'));
const SupportIssueBoard = lazy(() => import('./pages/admin/support/IssueBoard'));
const SupportFAQ = lazy(() => import('./pages/admin/support/FAQ'));
const SupportCanned = lazy(() => import('./pages/admin/support/CannedResponses'));
const SupportAgents = lazy(() => import('./pages/admin/support/Agents'));
const SupportTeams = lazy(() => import('./pages/admin/support/Teams'));
const SupportNotifications = lazy(() => import('./pages/admin/support/Notifications'));
const SupportFeedback = lazy(() => import('./pages/admin/support/Feedback'));
const SupportReports = lazy(() => import('./pages/admin/support/Reports'));
const SupportAudit = lazy(() => import('./pages/admin/support/AuditLogs'));
const SupportSettings = lazy(() => import('./pages/admin/support/SupportSettings'));
// Order Management (ORDER_MANAGER)
const OMDashboard = lazy(() => import('./pages/admin/order-mgmt/OrderDashboard'));
const OMOrders = lazy(() => import('./pages/admin/order-mgmt/OrdersList'));
const OMDetail = lazy(() => import('./pages/admin/order-mgmt/OrderDetails'));
const OMAssign = lazy(() => import('./pages/admin/order-mgmt/Assignment'));
const OMComm = lazy(() => import('./pages/admin/order-mgmt/Communication'));
const OMReports = lazy(() => import('./pages/admin/order-mgmt/ReportsAudit').then((m) => ({ default: m.OrderReports })));
const OMAudit = lazy(() => import('./pages/admin/order-mgmt/ReportsAudit').then((m) => ({ default: m.OrderAuditPage })));
const OMNotes = lazy(() => import('./pages/admin/order-mgmt/NotesTimeline').then((m) => ({ default: m.OrderNotes })));
const OMTimeline = lazy(() => import('./pages/admin/order-mgmt/NotesTimeline').then((m) => ({ default: m.OrderTimelinePage })));
// Inventory Management (INVENTORY_MANAGER)
const InvDashboard = lazy(() => import('./pages/admin/inventory/InventoryDashboard'));
const InvAdjust = lazy(() => import('./pages/admin/inventory/Adjustments'));
const InvMove = lazy(() => import('./pages/admin/inventory/Movements').then((m) => ({ default: m.Movements })));
const InvRes = lazy(() => import('./pages/admin/inventory/Movements').then((m) => ({ default: m.Reservations })));
const InvStock = lazy(() => import('./pages/admin/inventory/StockPages').then((m) => ({ default: m.StockOverview })));
const InvProductsHub = lazy(() => import('./pages/admin/inventory/ProductsInventory'));
const InvWh = lazy(() => import('./pages/admin/inventory/Warehouses').then((m) => ({ default: m.WarehouseHub })));
const InvBatch = lazy(() => import('./pages/admin/inventory/BatchExpiry').then((m) => ({ default: m.BatchesHub })));
const InvRet = lazy(() => import('./pages/admin/inventory/BatchExpiry').then((m) => ({ default: m.ReturnsHub })));
const InvVal = lazy(() => import('./pages/admin/inventory/AlertsReports').then((m) => ({ default: m.FinanceHub })));
const InvAlerts = lazy(() => import('./pages/admin/inventory/AlertsReports').then((m) => ({ default: m.Alerts })));
const InvAudit = lazy(() => import('./pages/admin/inventory/AlertsReports').then((m) => ({ default: m.AuditPage })));
const InvSettings = lazy(() => import('./pages/admin/inventory/AlertsReports').then((m) => ({ default: m.SettingsPage })));
// Delivery Network (zone-driven hybrid)
const DelDashboard = lazy(() => import('./pages/admin/delivery/DeliveryDashboard'));
const DelShip = lazy(() => import('./pages/admin/delivery/Shipments').then((m) => ({ default: m.AllShipments })));
const DelOwn = lazy(() => import('./pages/admin/delivery/Shipments').then((m) => ({ default: m.OwnOrders })));
const DelPending = lazy(() => import('./pages/admin/delivery/Shipments').then((m) => ({ default: m.PendingAssignment })));
const DelRiders = lazy(() => import('./pages/admin/delivery/Riders'));
const DelCouriers = lazy(() => import('./pages/admin/delivery/Couriers'));
const DelTrack = lazy(() => import('./pages/admin/delivery/TrackingSettlement').then((m) => ({ default: m.Tracking })));
const DelSettle = lazy(() => import('./pages/admin/delivery/TrackingSettlement').then((m) => ({ default: m.Settlement })));
const DelPerf = lazy(() => import('./pages/admin/delivery/PerformanceSettings').then((m) => ({ default: m.Performance })));
const DelSettings = lazy(() => import('./pages/admin/delivery/PerformanceSettings').then((m) => ({ default: m.DeliverySettings })));
const DelSlots = lazy(() => import('./pages/admin/delivery/PerformanceSettings').then((m) => ({ default: m.Slots })));
// Marketing (read-only growth analytics)
const MktDash = lazy(() => import('./pages/admin/marketing/MarketingDashboard'));
const MktSales = lazy(() => import('./pages/admin/marketing/Sales'));
const MktProducts = lazy(() => import('./pages/admin/marketing/Products'));
const MktCustomers = lazy(() => import('./pages/admin/marketing/Customers'));
const MktGeo = lazy(() => import('./pages/admin/marketing/GeoCoupons').then((m) => ({ default: m.Geography })));
const MktCoupons = lazy(() => import('./pages/admin/marketing/GeoCoupons').then((m) => ({ default: m.Coupons })));
const MktRetention = lazy(() => import('./pages/admin/marketing/RetentionGrowth').then((m) => ({ default: m.Retention })));
const MktGrowth = lazy(() => import('./pages/admin/marketing/RetentionGrowth').then((m) => ({ default: m.Growth })));
const MktQuality = lazy(() => import('./pages/admin/marketing/RetentionGrowth').then((m) => ({ default: m.Quality })));
const RiderApp = lazy(() => import('./pages/rider/RiderApp'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-10 h-10 border-3 border-primary-200 border-t-primary-700 rounded-full animate-spin" />
    </div>
  );
}

const Placeholder = ({ title }) => (
  <div className="text-center py-12">
    <h1 className="text-xl font-bold mb-2">{title}</h1>
    <p className="text-gray-500">Coming soon</p>
  </div>
);

const NotFound = () => (
  <div className="container-app py-16 text-center">
    <h1 className="text-4xl font-bold mb-4 text-primary-900">404</h1>
    <p className="text-gray-600">Page not found</p>
  </div>
);

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<CustomerLayout />}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="product/:id" element={<ProductDetails />} />
          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetails />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="payment/success" element={<PaymentResult type="success" />} />
          <Route path="payment/failed" element={<PaymentResult type="failed" />} />
          <Route path="account" element={<CustomerDashboard />} />
          <Route path="account/profile" element={<Profile />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="track" element={<Track />} />
          <Route path="faq" element={<Faq />} />
          <Route path="combos" element={<Placeholder title="Combo Packs" />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="/rider" element={<RiderRoute><RiderApp /></RiderRoute>} />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:id" element={<Placeholder title="Order Details" />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:id" element={<ProductForm />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="combos" element={<AdminCombos />} />
          <Route path="delivery-areas" element={<AdminDeliveryAreas initialTab="all" />} />
          <Route path="delivery-areas/grocery" element={<AdminDeliveryAreas initialTab="grocery" />} />
          <Route path="grocery-zones" element={<GroceryZones />} />
          <Route path="nationwide" element={<Nationwide />} />
          <Route path="free-delivery" element={<FreeDelivery />} />
          <Route path="delivery-analytics" element={<DeliveryAnalytics />} />
          <Route path="delivery-audit" element={<AuditLog />} />
          <Route path="accounting" element={<AccDashboard />} />
          <Route path="accounting/sales" element={<AccSales />} />
          <Route path="accounting/payments" element={<AccPayments />} />
          <Route path="accounting/expenses" element={<AccExpenses />} />
          <Route path="accounting/purchases" element={<AccPurchases />} />
          <Route path="accounting/refunds" element={<AccRefunds />} />
          <Route path="accounting/customers" element={<AccCustomers />} />
          <Route path="accounting/cash" element={<AccCashBank />} />
          <Route path="accounting/ledger" element={<AccLedger />} />
          <Route path="accounting/statements" element={<AccStatements />} />
          <Route path="accounting/delivery" element={<AccDelivery />} />
          <Route path="accounting/reports" element={<AccReports />} />
          <Route path="accounting/settings" element={<AccSettings />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="support" element={<SupportDashboard />} />
          <Route path="support/ai" element={<SupportAI />} />
          <Route path="support/chat" element={<SupportChat />} />
          <Route path="support/tickets" element={<SupportTickets />} />
          <Route path="support/tickets/:id" element={<SupportTicketDetails />} />
          <Route path="support/conversations" element={<SupportConversations />} />
          <Route path="support/customers" element={<SupportCustomer360 />} />
          <Route path="support/orders" element={<SupportIssueBoard mode="orders" />} />
          <Route path="support/payments" element={<SupportIssueBoard mode="payments" />} />
          <Route path="support/delivery" element={<SupportIssueBoard mode="delivery" />} />
          <Route path="support/returns" element={<SupportIssueBoard mode="returns" />} />
          <Route path="support/products" element={<SupportIssueBoard mode="products" />} />
          <Route path="support/complaints" element={<SupportIssueBoard mode="complaints" />} />
          <Route path="support/faq" element={<SupportFAQ />} />
          <Route path="support/canned" element={<SupportCanned />} />
          <Route path="support/agents" element={<SupportAgents />} />
          <Route path="support/teams" element={<SupportTeams />} />
          <Route path="support/notifications" element={<SupportNotifications />} />
          <Route path="support/feedback" element={<SupportFeedback />} />
          <Route path="support/reports" element={<SupportReports />} />
          <Route path="support/audit" element={<SupportAudit />} />
          <Route path="support/settings" element={<SupportSettings />} />
          <Route path="order-mgmt" element={<RequirePerm perms={['ORDER_VIEW', 'order.report.view']}><OMDashboard /></RequirePerm>} />
          <Route path="order-mgmt/orders" element={<RequirePerm perms={['ORDER_VIEW', 'order.search']}><OMOrders /></RequirePerm>} />
          <Route path="order-mgmt/orders/:id" element={<RequirePerm perms={['ORDER_VIEW', 'order.search']}><OMDetail /></RequirePerm>} />
          <Route path="order-mgmt/assignment" element={<RequirePerm perms={['order.assign', 'ORDER_ASSIGN_RIDER']}><OMAssign /></RequirePerm>} />
          <Route path="order-mgmt/notes" element={<RequirePerm perms={['order.note.view', 'ORDER_VIEW']}><OMNotes /></RequirePerm>} />
          <Route path="order-mgmt/timeline" element={<RequirePerm perms={['ORDER_VIEW', 'order.audit.view']}><OMTimeline /></RequirePerm>} />
          <Route path="order-mgmt/communication" element={<RequirePerm perms={['order.communication.send']}><OMComm /></RequirePerm>} />
          <Route path="order-mgmt/reports" element={<RequirePerm perms={['order.report.view']}><OMReports /></RequirePerm>} />
          <Route path="order-mgmt/audit" element={<RequirePerm perms={['order.audit.view']}><OMAudit /></RequirePerm>} />
          <Route path="inventory" element={<RequirePerm perms={['inventory.view', 'inventory.report.view']}><InvDashboard /></RequirePerm>} />
          <Route path="inventory/overview" element={<RequirePerm perms={['inventory.stock.view']}><InvStock /></RequirePerm>} />
          {/* Merged into Stock hub — old URL redirects, same perm, no 404 for bookmarks */}
          <Route path="inventory/products" element={<RequirePerm perms={['inventory.stock.view']}><Navigate to="/admin/inventory/overview" replace /></RequirePerm>} />
          <Route path="inventory/products-inventory" element={<RequirePerm perms={['inventory.stock.view', 'product.import', 'product.bulk_edit']}><InvProductsHub /></RequirePerm>} />
          <Route path="inventory/reservations" element={<RequirePerm perms={['inventory.reservation.view']}><InvRes /></RequirePerm>} />
          <Route path="inventory/movements" element={<RequirePerm perms={['inventory.movement.view']}><InvMove /></RequirePerm>} />
          <Route path="inventory/adjustments" element={<RequirePerm perms={['inventory.stock.adjust', 'inventory.stock.view']}><InvAdjust /></RequirePerm>} />
          {/* Stock hub tabs — old URLs redirect to the right tab, same perm */}
          <Route path="inventory/low-stock" element={<RequirePerm perms={['inventory.stock.view']}><Navigate to="/admin/inventory/overview?tab=low" replace /></RequirePerm>} />
          <Route path="inventory/out-of-stock" element={<RequirePerm perms={['inventory.stock.view']}><Navigate to="/admin/inventory/overview?tab=out" replace /></RequirePerm>} />
          <Route path="inventory/warehouses" element={<RequirePerm perms={['inventory.warehouse.view', 'inventory.transfer.view', 'inventory.purchase.receive']}><InvWh /></RequirePerm>} />
          {/* Warehouse hub tabs — old URLs redirect to the right tab, original perm kept */}
          <Route path="inventory/transfers" element={<RequirePerm perms={['inventory.transfer.view']}><Navigate to="/admin/inventory/warehouses?tab=transfers" replace /></RequirePerm>} />
          <Route path="inventory/receiving" element={<RequirePerm perms={['inventory.purchase.receive']}><Navigate to="/admin/inventory/warehouses?tab=receiving" replace /></RequirePerm>} />
          <Route path="inventory/batches" element={<RequirePerm perms={['inventory.batch.view', 'inventory.expiry.view']}><InvBatch /></RequirePerm>} />
          <Route path="inventory/expiry" element={<RequirePerm perms={['inventory.expiry.view']}><Navigate to="/admin/inventory/batches?tab=expiry" replace /></RequirePerm>} />
          <Route path="inventory/returns" element={<RequirePerm perms={['inventory.return.view', 'inventory.damage.view']}><InvRet /></RequirePerm>} />
          <Route path="inventory/damaged" element={<RequirePerm perms={['inventory.damage.view']}><Navigate to="/admin/inventory/returns?tab=damaged" replace /></RequirePerm>} />
          <Route path="inventory/valuation" element={<RequirePerm perms={['inventory.valuation.view', 'inventory.report.view']}><InvVal /></RequirePerm>} />
          <Route path="inventory/alerts" element={<RequirePerm perms={['inventory.alert.view']}><InvAlerts /></RequirePerm>} />
          {/* Finance hub tab — old URL redirects, original perm kept */}
          <Route path="inventory/reports" element={<RequirePerm perms={['inventory.report.view']}><Navigate to="/admin/inventory/valuation?tab=reports" replace /></RequirePerm>} />
          <Route path="inventory/audit" element={<RequirePerm perms={['inventory.audit.view']}><InvAudit /></RequirePerm>} />
          <Route path="inventory/settings" element={<RequirePerm perms={['inventory.settings.view']}><InvSettings /></RequirePerm>} />
          <Route path="delivery" element={<RequirePerm perms={['delivery.view', 'delivery.report.view']}><DelDashboard /></RequirePerm>} />
          <Route path="delivery/own" element={<RequirePerm perms={['delivery.shipment.view']}><DelOwn /></RequirePerm>} />
          <Route path="delivery/pending" element={<RequirePerm perms={['delivery.shipment.view']}><DelPending /></RequirePerm>} />
          <Route path="delivery/riders" element={<RequirePerm perms={['delivery.rider.view']}><DelRiders /></RequirePerm>} />
          <Route path="delivery/couriers" element={<RequirePerm perms={['delivery.courier.view']}><DelCouriers /></RequirePerm>} />
          <Route path="delivery/shipments" element={<RequirePerm perms={['delivery.shipment.view']}><DelShip /></RequirePerm>} />
          <Route path="delivery/tracking" element={<RequirePerm perms={['delivery.tracking.view']}><DelTrack /></RequirePerm>} />
          <Route path="delivery/settlement" element={<RequirePerm perms={['delivery.settlement.view']}><DelSettle /></RequirePerm>} />
          <Route path="delivery/slots" element={<RequirePerm perms={['DELIVERY_AREA_UPDATE', 'DELIVERY_AREA_VIEW']}><DelSlots /></RequirePerm>} />
          <Route path="delivery/performance" element={<RequirePerm perms={['delivery.report.view']}><DelPerf /></RequirePerm>} />
          <Route path="delivery/reports" element={<RequirePerm perms={['delivery.report.view']}><DelPerf /></RequirePerm>} />
          <Route path="delivery/settings" element={<RequirePerm perms={['delivery.courier.manage']}><DelSettings /></RequirePerm>} />
          <Route path="marketing" element={<RequirePerm perms={['marketing.view', 'marketing.report.view']}><MktDash /></RequirePerm>} />
          <Route path="marketing/sales" element={<RequirePerm perms={['marketing.view', 'marketing.report.view']}><MktSales /></RequirePerm>} />
          <Route path="marketing/products" element={<RequirePerm perms={['marketing.view', 'marketing.report.view']}><MktProducts /></RequirePerm>} />
          <Route path="marketing/customers" element={<RequirePerm perms={['marketing.view', 'marketing.report.view']}><MktCustomers /></RequirePerm>} />
          <Route path="marketing/geo" element={<RequirePerm perms={['marketing.view', 'marketing.report.view']}><MktGeo /></RequirePerm>} />
          <Route path="marketing/coupons" element={<RequirePerm perms={['marketing.view', 'marketing.report.view']}><MktCoupons /></RequirePerm>} />
          <Route path="marketing/retention" element={<RequirePerm perms={['marketing.view', 'marketing.report.view']}><MktRetention /></RequirePerm>} />
          <Route path="marketing/growth" element={<RequirePerm perms={['marketing.view', 'marketing.report.view']}><MktGrowth /></RequirePerm>} />
          <Route path="marketing/quality" element={<RequirePerm perms={['marketing.view', 'marketing.report.view']}><MktQuality /></RequirePerm>} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;

import { useState, Fragment } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  FolderTree,
  Users,
  Truck,
  Globe2,
  Gift,
  ShieldCheck,
  Wallet,
  CreditCard,
  Receipt,
  RotateCcw,
  Landmark,
  BookOpen,
  FileText,
  Tag,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  BarChart3,
  MapPin,
  ChevronDown,
  Headset,
  MessagesSquare,
  Ticket,
  Bot,
  UserSearch,
  Bell,
  Star,
  ScrollText,
  LifeBuoy,
  Clock,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { can } from '../../utils/permissions';
import { ClipboardList, PauseCircle, XCircle, AlertCircle, UserCheck, StickyNote, History, Send, FileBarChart, Boxes, Warehouse, ArrowLeftRight, CalendarClock, TriangleAlert, Undo2, Calculator, BellRing, Settings2, Megaphone, TrendingUp, Users2, MapPinned, BadgePercent, Repeat2, ShieldAlert, Rocket, ExternalLink } from 'lucide-react';

// Sidebar follows the daily ops workflow:
// Dashboard → Orders → Delivery → Inventory → Support → Finance → Catalog → System.
// `section` renders a small group heading; items stay permission-filtered.
const navItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  {
    path: '/admin/order-mgmt',
    icon: ClipboardList,
    label: 'Order Management',
    section: 'Sales & Fulfillment',
    perms: ['ORDER_VIEW', 'order.search', 'order.filter'],
    children: [
      { path: '/admin/order-mgmt', icon: LayoutDashboard, label: 'Dashboard', end: true, perms: ['ORDER_VIEW', 'order.report.view'] },
      { path: '/admin/order-mgmt/orders', icon: ShoppingBag, label: 'All Orders', perms: ['ORDER_VIEW', 'order.search'] },
      { path: '/admin/orders', icon: FileText, label: 'Classic List', perms: ['ORDER_VIEW'] },
      { path: '/admin/order-mgmt/orders?status=Pending', icon: ShoppingBag, label: 'New Orders', perms: ['ORDER_VIEW', 'order.search'] },
      { path: '/admin/order-mgmt/orders?status=PENDING_VERIFICATION', icon: ShieldCheck, label: 'Pending Verification', perms: ['ORDER_VIEW', 'order.search'] },
      { path: '/admin/order-mgmt/orders?status=Confirmed', icon: ShieldCheck, label: 'Confirmed', perms: ['ORDER_VIEW', 'order.search'] },
      { path: '/admin/order-mgmt/orders?status=Processing', icon: Package, label: 'Processing', perms: ['ORDER_VIEW', 'order.search'] },
      { path: '/admin/order-mgmt/orders?status=READY_TO_SHIP', icon: Package, label: 'Ready to Ship', perms: ['ORDER_VIEW', 'order.search'] },
      { path: '/admin/order-mgmt/orders?status=Shipped', icon: Truck, label: 'Shipped', perms: ['ORDER_VIEW', 'order.search'] },
      { path: '/admin/order-mgmt/orders?status=OUT_FOR_DELIVERY', icon: Truck, label: 'Out for Delivery', perms: ['ORDER_VIEW', 'order.search'] },
      { path: '/admin/order-mgmt/orders?status=Delivered', icon: UserCheck, label: 'Delivered', perms: ['ORDER_VIEW', 'order.search'] },
      { path: '/admin/order-mgmt/orders?status=ON_HOLD', icon: PauseCircle, label: 'On Hold', perms: ['ORDER_VIEW', 'order.search'] },
      { path: '/admin/order-mgmt/orders?status=Cancelled', icon: XCircle, label: 'Cancelled', perms: ['ORDER_VIEW', 'order.search'] },
      { path: '/admin/order-mgmt/orders?status=FAILED', icon: AlertCircle, label: 'Failed', perms: ['ORDER_VIEW', 'order.search'] },
      { path: '/admin/order-mgmt/assignment', icon: UserCheck, label: 'Order Assignment', perms: ['order.assign', 'ORDER_ASSIGN_RIDER'] },
      { path: '/admin/order-mgmt/notes', icon: StickyNote, label: 'Order Notes', perms: ['order.note.view', 'ORDER_VIEW'] },
      { path: '/admin/order-mgmt/timeline', icon: History, label: 'Order Timeline', perms: ['ORDER_VIEW', 'order.audit.view'] },
      { path: '/admin/order-mgmt/communication', icon: Send, label: 'Customer Communication', perms: ['order.communication.send'] },
      { path: '/admin/order-mgmt/reports', icon: FileBarChart, label: 'Reports', perms: ['order.report.view'] },
      { path: '/admin/order-mgmt/audit', icon: ScrollText, label: 'Audit Logs', perms: ['order.audit.view'] },
    ],
  },
  {
    path: '/admin/delivery',
    icon: Truck,
    label: 'Delivery Management',
    perms: ['delivery.view', 'DELIVERY_AREA_VIEW'],
    children: [
      { path: '/admin/delivery', icon: LayoutDashboard, label: 'Dashboard', end: true, perms: ['delivery.view', 'delivery.report.view'] },
      { path: '/admin/delivery/own', icon: UserCheck, label: 'Own Delivery', perms: ['delivery.shipment.view'] },
      { path: '/admin/delivery/pending', icon: PauseCircle, label: 'Pending Assignment', perms: ['delivery.shipment.view'] },
      { path: '/admin/delivery/shipments', icon: Package, label: 'All Shipments', perms: ['delivery.shipment.view'] },
      { path: '/admin/delivery/tracking', icon: MapPin, label: 'Tracking', perms: ['delivery.tracking.view'] },
      { path: '/admin/delivery/riders', icon: Users, label: 'Riders', perms: ['delivery.rider.view'] },
      { path: '/admin/grocery-zones', icon: MapPin, label: 'Grocery Zones' },
      { path: '/admin/delivery/couriers', icon: Globe2, label: 'External Courier', perms: ['delivery.courier.view'] },
      { path: '/admin/delivery/settlement', icon: Wallet, label: 'COD Settlement', perms: ['delivery.settlement.view'] },
      { path: '/admin/delivery/slots', icon: Clock, label: 'Delivery Slots', perms: ['DELIVERY_AREA_UPDATE', 'DELIVERY_AREA_VIEW'] },
      { path: '/admin/delivery/performance', icon: BarChart3, label: 'Performance', perms: ['delivery.report.view'] },
      { path: '/admin/nationwide', icon: Globe2, label: 'Nationwide Charges' },
      { path: '/admin/free-delivery', icon: Gift, label: 'Free Delivery' },
      { path: '/admin/delivery-analytics', icon: BarChart3, label: 'Analytics' },
      { path: '/admin/delivery/reports', icon: FileBarChart, label: 'Reports', perms: ['delivery.report.view'] },
      { path: '/admin/delivery/settings', icon: Settings, label: 'Delivery Settings', perms: ['delivery.courier.manage'] },
      { path: '/admin/delivery-audit', icon: ShieldCheck, label: 'Audit Log' },
    ],
  },
  {
    path: '/admin/marketing',
    icon: Megaphone,
    label: 'Marketing',
    section: 'Growth',
    perms: ['marketing.view', 'marketing.report.view'],
    children: [
      { path: '/admin/marketing', icon: LayoutDashboard, label: 'Dashboard', end: true, perms: ['marketing.view', 'marketing.report.view'] },
      { path: '/admin/marketing/sales', icon: TrendingUp, label: 'Sales Analytics', perms: ['marketing.view', 'marketing.report.view'] },
      { path: '/admin/marketing/products', icon: Package, label: 'Product Performance', perms: ['marketing.view', 'marketing.report.view'] },
      { path: '/admin/marketing/customers', icon: Users2, label: 'Customers & RFM', perms: ['marketing.view', 'marketing.report.view'] },
      { path: '/admin/marketing/geo', icon: MapPinned, label: 'Geography', perms: ['marketing.view', 'marketing.report.view'] },
      { path: '/admin/marketing/coupons', icon: BadgePercent, label: 'Coupons & Campaigns', perms: ['marketing.view', 'marketing.report.view'] },
      { path: '/admin/marketing/retention', icon: Repeat2, label: 'Retention', perms: ['marketing.view', 'marketing.report.view'] },
      { path: '/admin/marketing/growth', icon: Rocket, label: 'Growth Levers', perms: ['marketing.view', 'marketing.report.view'] },
      { path: '/admin/marketing/quality', icon: ShieldAlert, label: 'Data Quality', perms: ['marketing.view', 'marketing.report.view'] },
    ],
  },
  {
    path: '/admin/accounting',
    icon: Wallet,
    label: 'Accounting',
    section: 'Finance',
    children: [
      { path: '/admin/accounting', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { path: '/admin/accounting/sales', icon: ShoppingBag, label: 'Sales & Orders' },
      { path: '/admin/accounting/payments', icon: CreditCard, label: 'Payments' },
      { path: '/admin/accounting/expenses', icon: Receipt, label: 'Expenses' },
      { path: '/admin/accounting/purchases', icon: Package, label: 'Purchases' },
      { path: '/admin/accounting/refunds', icon: RotateCcw, label: 'Refunds' },
      { path: '/admin/accounting/customers', icon: Users, label: 'Customers' },
      { path: '/admin/accounting/cash', icon: Landmark, label: 'Cash & Bank' },
      { path: '/admin/accounting/ledger', icon: BookOpen, label: 'Ledger' },
      { path: '/admin/accounting/statements', icon: FileText, label: 'Statements' },
      { path: '/admin/accounting/delivery', icon: Truck, label: 'Delivery' },
      { path: '/admin/accounting/reports', icon: BarChart3, label: 'Reports' },
      { path: '/admin/accounting/settings', icon: Settings, label: 'Settings' },
    ],
  },
  {
    path: '/admin/inventory',
    icon: Boxes,
    label: 'Inventory Management',
    perms: ['inventory.view', 'inventory.stock.view'],
    children: [
      { path: '/admin/inventory', icon: LayoutDashboard, label: 'Dashboard', end: true, perms: ['inventory.view', 'inventory.report.view'] },
      { path: '/admin/inventory/overview', icon: Boxes, label: 'Stock Overview', group: 'Stock', perms: ['inventory.stock.view'] },
      { path: '/admin/inventory/products-inventory', icon: Boxes, label: 'Products Inventory', group: 'Stock', perms: ['inventory.stock.view', 'product.import', 'product.bulk_edit'] },
      { path: '/admin/inventory/reservations', icon: UserCheck, label: 'Stock Reservation', group: 'Stock', perms: ['inventory.reservation.view'] },
      { path: '/admin/inventory/movements', icon: History, label: 'Stock Movement', group: 'Stock', perms: ['inventory.movement.view'] },
      { path: '/admin/inventory/adjustments', icon: Settings2, label: 'Stock Adjustment', group: 'Stock', perms: ['inventory.stock.adjust', 'inventory.stock.view'] },
      { path: '/admin/inventory/warehouses', icon: Warehouse, label: 'Warehouses & Transfers', group: 'Warehouse', perms: ['inventory.warehouse.view', 'inventory.transfer.view', 'inventory.purchase.receive'] },
      { path: '/admin/inventory/batches', icon: FileText, label: 'Batches & Expiry', group: 'Quality', perms: ['inventory.batch.view', 'inventory.expiry.view'] },
      { path: '/admin/inventory/returns', icon: Undo2, label: 'Returns & Damage', group: 'Quality', perms: ['inventory.return.view', 'inventory.damage.view'] },
      { path: '/admin/inventory/valuation', icon: Calculator, label: 'Valuation & Reports', group: 'Finance', perms: ['inventory.valuation.view', 'inventory.report.view'] },
      { path: '/admin/inventory/alerts', icon: BellRing, label: 'Stock Alerts', group: 'System', perms: ['inventory.alert.view'] },
      { path: '/admin/inventory/audit', icon: ScrollText, label: 'Audit Logs', group: 'System', perms: ['inventory.audit.view'] },
      { path: '/admin/inventory/settings', icon: Settings, label: 'Inventory Settings', group: 'System', perms: ['inventory.settings.view'] },
    ],
  },
  {
    path: '/admin/support',
    icon: Headset,
    label: 'Customer Support',
    children: [
      { path: '/admin/support', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { path: '/admin/support/chat', icon: MessagesSquare, label: 'Live Chat' },
      { path: '/admin/support/tickets', icon: Ticket, label: 'All Tickets' },
      { path: '/admin/support/tickets?status=OPEN', icon: Ticket, label: 'Open' },
      { path: '/admin/support/tickets?status=ASSIGNED', icon: Ticket, label: 'Assigned' },
      { path: '/admin/support/tickets?status=IN_PROGRESS', icon: Ticket, label: 'In Progress' },
      { path: '/admin/support/tickets?status=WAITING_CUSTOMER', icon: Ticket, label: 'Waiting for Customer' },
      { path: '/admin/support/tickets?status=RESOLVED', icon: Ticket, label: 'Resolved' },
      { path: '/admin/support/tickets?status=CLOSED', icon: Ticket, label: 'Closed' },
      { path: '/admin/support/tickets?status=REOPENED', icon: Ticket, label: 'Reopened' },
      { path: '/admin/support/conversations', icon: MessagesSquare, label: 'All Conversations' },
      { path: '/admin/support/customers', icon: UserSearch, label: 'Customer 360°' },
      { path: '/admin/support/orders', icon: ShoppingBag, label: 'Order Support' },
      { path: '/admin/support/payments', icon: CreditCard, label: 'Payment Support' },
      { path: '/admin/support/delivery', icon: Truck, label: 'Delivery Support' },
      { path: '/admin/support/returns', icon: RotateCcw, label: 'Return & Refund' },
      { path: '/admin/support/products', icon: Package, label: 'Product Support' },
      { path: '/admin/support/complaints', icon: LifeBuoy, label: 'Complaints' },
      { path: '/admin/support/faq', icon: BookOpen, label: 'FAQ / Knowledge Base' },
      { path: '/admin/support/canned', icon: FileText, label: 'Canned Responses' },
      { path: '/admin/support/agents', icon: Users, label: 'Support Agents' },
      { path: '/admin/support/teams', icon: Users, label: 'Support Teams' },
      { path: '/admin/support/notifications', icon: Bell, label: 'Notifications' },
      { path: '/admin/support/feedback', icon: Star, label: 'Customer Feedback' },
      { path: '/admin/support/reports', icon: BarChart3, label: 'Reports & Analytics' },
      { path: '/admin/support/audit', icon: ScrollText, label: 'Audit Logs' },
      { path: '/admin/support/settings', icon: Settings, label: 'Support Settings' },
      { path: '/admin/support/ai', icon: Bot, label: 'AI Assistant' },
    ],
  },
  { path: '/admin/categories', icon: FolderTree, label: 'Categories', section: 'Catalog' },
  { path: '/admin/products', icon: Package, label: 'Products' },
  { path: '/admin/combos', icon: Tag, label: 'Combos' },
  { path: '/admin/coupons', icon: Tag, label: 'Coupons' },
  { path: '/admin/users', icon: Users, label: 'Users', section: 'System' },
  { path: '/admin/reports', icon: BarChart3, label: 'Reports' },
  { path: '/admin/settings', icon: Settings, label: 'Settings' },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path, end) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const [openMenu, setOpenMenu] = useState(null);
  const fullPath = `${location.pathname}${location.search}`;
  const isSubActive = (subPath) => {
    if (subPath.includes('?')) return fullPath === subPath;
    return location.pathname === subPath;
  };
  const isGroupActive = (item) =>
    item.children?.some((s) => isSubActive(s.path)) || location.pathname.startsWith(item.path + '/') || location.pathname === item.path;

  return (
    <div className="min-h-screen bg-[#f7f5f0] dark:bg-[#0a0f0c]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-[#0b3d2a] text-white transform transition-transform lg:translate-x-0 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <Link to="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center font-bold">
              M
            </div>
            <span className="font-bold">Admin Panel</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto min-h-0">
          {navItems
            .filter((item) => !item.perms || can(user, ...item.perms))
            .map((item, idx, visible) => {
            const visibleChildren = item.children?.filter((s) => !s.perms || can(user, ...s.perms));
            if (visibleChildren && visibleChildren.length === 0) return null;
            const showSection = item.section && (idx === 0 || visible[idx - 1]?.section !== item.section);
            const sectionHead = showSection ? (
              <p key={`sec-${item.section}`} className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-400/80">
                {item.section}
              </p>
            ) : null;
            if (!item.children) {
              return (
                <Fragment key={item.path}>
                  {sectionHead}
                  <Link
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive(item.path, item.end)
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                </Fragment>
              );
            }
            const expanded = openMenu === item.path || isGroupActive(item);
            return (
              <Fragment key={item.path}>
                {sectionHead}
              <div>
                <button
                  type="button"
                  onClick={() => setOpenMenu(expanded && openMenu === item.path ? null : item.path)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors w-full ${
                    isGroupActive(item) ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && (
                  <div className="ml-5 mt-1 space-y-1 border-l border-white/15 pl-2">
                    {(visibleChildren || []).map((sub, si, sarr) => (
                      <Fragment key={sub.path}>
                        {sub.group && (si === 0 || sarr[si - 1]?.group !== sub.group) && (
                          <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-400/80">
                            {sub.group}
                          </p>
                        )}
                        <Link
                          to={sub.path}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                            isSubActive(sub.path)
                              ? 'bg-gold-400 text-[#0a0f0c] font-semibold'
                              : 'text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          <sub.icon className="w-4 h-4" />
                          {sub.label}
                        </Link>
                      </Fragment>
                    ))}
                  </div>
                )}
              </div>
              </Fragment>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 shrink-0 bg-[#0b3d2a]">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-white/10 rounded-lg mb-1"
          >
            <Home className="w-5 h-5" />
            View Store
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-white/10 rounded-lg w-full"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <header className="bg-white dark:bg-[#12241a] border-b border-[#e5e2da] dark:border-[#2a3b30] sticky top-0 z-30">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2">
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 dark:text-ash">{user?.name}</span>
              <span className="text-xs bg-primary-100 text-primary-700 dark:bg-gold-400/15 dark:text-gold-300 px-2 py-1 rounded">
                {user?.role}
              </span>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

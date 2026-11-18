import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Heart,
  ShoppingCart,
  User as UserIcon,
  Package,
  Wallet,
  ChevronRight,
} from 'lucide-react';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useCartStore from '../store/cartStore';
import SEO from '../components/seo/SEO';

export default function CustomerDashboard() {
  const { user, isAuthenticated } = useAuthStore();
  const cartItems = useCartStore((s) => s.items);
  const navigate = useNavigate();

  const [stats, setStats] = useState({ orders: 0, spent: 0, wishlist: 0 });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    load();
  }, [isAuthenticated]);

  const load = async () => {
    setLoading(true);
    try {
      const [ordersRes, wishRes] = await Promise.all([
        api.get('/orders/my-orders', { params: { page: 1, limit: 50 } }).catch(() => ({ data: {} })),
        api.get('/wishlist').catch(() => ({ data: {} })),
      ]);
      const orders = ordersRes.data?.data || [];
      const spent = orders
        .filter((o) => o.orderStatus !== 'Cancelled')
        .reduce((s, o) => s + (o.totalAmount || 0), 0);
      const wishItems = wishRes.data?.data?.items || wishRes.data?.data || [];
      setStats({
        orders: ordersRes.data?.total || orders.length,
        spent,
        wishlist: Array.isArray(wishItems) ? wishItems.length : 0,
      });
      setRecent(orders.slice(0, 5));
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  const cards = [
    { label: 'Total Orders', value: loading ? '…' : stats.orders, icon: Package, bg: 'bg-primary-700', link: '/orders' },
    { label: 'Total Spent', value: loading ? '…' : `৳${stats.spent.toLocaleString()}`, icon: Wallet, bg: 'bg-gold-500', link: '/orders' },
    { label: 'Wishlist', value: loading ? '…' : stats.wishlist, icon: Heart, bg: 'bg-success', link: '/wishlist' },
    { label: 'Cart Items', value: cartItems.reduce((s, i) => s + i.quantity, 0), icon: ShoppingCart, bg: 'bg-danger', link: '/cart' },
  ];

  const quickLinks = [
    { to: '/shop', icon: ShoppingBag, label: 'Shop Now' },
    { to: '/orders', icon: Package, label: 'My Orders' },
    { to: '/wishlist', icon: Heart, label: 'Wishlist' },
    { to: '/cart', icon: ShoppingCart, label: 'Cart' },
    { to: '/account/profile', icon: UserIcon, label: 'Edit Profile' },
  ];

  return (
    <>
      <SEO title="My Account" path="/account" noindex />
      <div className="container-app py-6 sm:py-8">
        {/* Profile header */}
        <div className="card p-5 sm:p-6 mb-6 flex items-center gap-4">
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover ring-2 ring-gold-400" />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary-700 text-white flex items-center justify-center text-2xl font-bold">
              {user?.name?.[0]?.toUpperCase() || <UserIcon className="w-8 h-8" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold truncate">Welcome, {user?.name}!</h1>
            <p className="text-sm text-gray-500 dark:text-ash truncate">{user?.phone} {user?.email ? `• ${user.email}` : ''}</p>
          </div>
          <Link to="/account/profile" className="btn-outline text-sm whitespace-nowrap">
            Edit Profile
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {cards.map((c) => (
            <Link key={c.label} to={c.link} className="card p-4 sm:p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-ash truncate">{c.label}</p>
                  <p className="text-lg sm:text-2xl font-bold mt-1 truncate">{c.value}</p>
                </div>
                <div className={`${c.bg} p-2.5 sm:p-3 rounded-lg text-white flex-shrink-0`}>
                  <c.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent orders */}
          <div className="lg:col-span-2 card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Recent Orders</h2>
              <Link to="/orders" className="text-sm text-primary-600 dark:text-gold-300 hover:underline inline-flex items-center gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            {loading ? (
              <p className="text-sm text-gray-500 dark:text-ash py-6 text-center">Loading…</p>
            ) : recent.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-ash mb-3">No orders yet</p>
                <Link to="/shop" className="btn-primary text-sm">Start Shopping</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recent.map((o) => (
                  <Link
                    key={o._id}
                    to={`/orders/${o._id}`}
                    className="flex items-center justify-between gap-2 p-3 rounded-lg border border-[#e5e2da] dark:border-[#2a3b30] hover:bg-[#f7f5f0] dark:hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">#{o.orderNumber}</p>
                      <p className="text-xs text-gray-500 dark:text-ash">
                        {new Date(o.createdAt).toLocaleDateString()} • {o.orderStatus}
                      </p>
                    </div>
                    <span className="font-semibold text-sm whitespace-nowrap">৳{o.totalAmount}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="card p-5 h-fit">
            <h2 className="font-semibold mb-4">Quick Links</h2>
            <div className="space-y-1">
              {quickLinks.map((q) => (
                <Link
                  key={q.to + q.label}
                  to={q.to}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f7f5f0] dark:hover:bg-white/5 text-sm font-medium"
                >
                  <q.icon className="w-4 h-4 text-primary-700 dark:text-gold-300" />
                  {q.label}
                  <ChevronRight className="w-4 h-4 ml-auto text-gray-400" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

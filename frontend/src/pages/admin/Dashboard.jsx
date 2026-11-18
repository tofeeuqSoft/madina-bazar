import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, ShoppingBag, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import api from '../../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState({
    orders: 0,
    products: 0,
    lowStock: 0,
    pendingOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [ordersRes, productsRes, lowStockRes] = await Promise.all([
        api.get('/orders', { params: { limit: 5 } }).catch(() => ({ data: { total: 0, data: [] } })),
        api.get('/products', { params: { limit: 1, isActive: 'all' } }).catch(() => ({ data: { total: 0 } })),
        api.get('/products/inventory/low-stock').catch(() => ({ data: { count: 0 } })),
      ]);

      const pendingRes = await api
        .get('/orders', { params: { status: 'Pending', limit: 1 } })
        .catch(() => ({ data: { total: 0 } }));

      setStats({
        orders: ordersRes.data.total || 0,
        products: productsRes.data.total || 0,
        lowStock: lowStockRes.data.count || 0,
        pendingOrders: pendingRes.data.total || 0,
      });
      setRecentOrders(ordersRes.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    { label: 'Total Orders', value: stats.orders, icon: ShoppingBag, color: 'bg-primary-700', link: '/admin/orders' },
    { label: 'Products', value: stats.products, icon: Package, color: 'bg-success', link: '/admin/products' },
    { label: 'Pending Orders', value: stats.pendingOrders, icon: TrendingUp, color: 'bg-gold-500', link: '/admin/orders?status=Pending' },
    { label: 'Low Stock', value: stats.lowStock, icon: AlertTriangle, color: 'bg-danger', link: '/admin/products?lowStock=1' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <Link
            key={card.label}
            to={card.link}
            className="bg-white dark:bg-[#12241a] rounded-xl p-5 shadow-sm border border-[#e5e2da] dark:border-[#2a3b30] hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-ash">{card.label}</p>
                <p className="text-2xl font-bold mt-1">
                  {loading ? '...' : card.value}
                </p>
              </div>
              <div className={`${card.color} p-3 rounded-lg text-white`}>
                <card.icon className="w-6 h-6" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-white dark:bg-[#12241a] rounded-xl shadow-sm border border-[#e5e2da] dark:border-[#2a3b30]">
        <div className="flex items-center justify-between p-5 border-b border-[#e5e2da] dark:border-[#2a3b30]">
          <h2 className="font-semibold">Recent Orders</h2>
          <Link to="/admin/orders" className="text-sm text-primary-600 dark:text-gold-300 hover:underline">
            View All
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f5f0] dark:bg-white/5">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600 dark:text-ash">Order</th>
                <th className="text-left p-4 font-medium text-gray-600 dark:text-ash">Customer</th>
                <th className="text-left p-4 font-medium text-gray-600 dark:text-ash">Total</th>
                <th className="text-left p-4 font-medium text-gray-600 dark:text-ash">Status</th>
                <th className="text-left p-4 font-medium text-gray-600 dark:text-ash">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-ash">
                    No orders yet
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30] hover:bg-[#f7f5f0] dark:hover:bg-white/5">
                    <td className="p-4">
                      <Link to={`/admin/orders/${order._id}`} className="text-primary-600 dark:text-gold-300 hover:underline">
                        #{order.orderNumber}
                      </Link>
                    </td>
                    <td className="p-4">{order.customer?.name || order.shippingAddress?.fullName}</td>
                    <td className="p-4 font-medium">৳{order.totalAmount}</td>
                    <td className="p-4">
                      <span className="text-xs px-2 py-1 rounded-full bg-black/5 text-smoke dark:bg-white/10 dark:text-ash">
                        {order.orderStatus}
                      </span>
                    </td>
                    <td className="p-4 text-gray-500 dark:text-ash">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

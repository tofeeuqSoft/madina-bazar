import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, ChevronRight } from 'lucide-react';
import api from '../services/api';
import useAuthStore from '../store/authStore';

const statusColors = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Confirmed: 'bg-blue-100 text-blue-800',
  Processing: 'bg-indigo-100 text-indigo-800',
  'Ready for Delivery': 'bg-purple-100 text-purple-800',
  'Out for Delivery': 'bg-orange-100 text-orange-800',
  Delivered: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
};

export default function Orders() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadOrders();
  }, [page, isAuthenticated]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/orders/my-orders', { params: { page, limit: 10 } });
      setOrders(data.data || []);
      setPages(data.pages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container-app py-8">
        <h1 className="text-2xl font-bold mb-6">My Orders</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="container-app py-16 text-center">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
        <p className="text-gray-500 mb-6">Start shopping to place your first order</p>
        <Link to="/shop" className="btn-primary">Shop Now</Link>
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      <h1 className="text-2xl font-bold mb-6">My Orders</h1>

      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order._id} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-semibold">#{order.orderNumber}</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[order.orderStatus] || 'bg-gray-100'}`}>
                    {order.orderStatus}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {new Date(order.createdAt).toLocaleDateString('en-BD', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {order.orderItems?.length || 0} item(s) · {order.paymentMethod}
                </p>
              </div>

              <div className="text-right">
                <p className="text-lg font-bold text-primary-600">৳{order.totalAmount}</p>
                <p className="text-xs text-gray-500">{order.paymentStatus}</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {order.shippingAddress?.area || order.deliveryArea?.name || 'Mirpur'}
              </div>
              <Link
                to={`/orders/${order._id}`}
                className="text-sm text-primary-600 font-medium flex items-center hover:underline"
              >
                View Details <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="btn-outline text-sm"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm">Page {page} of {pages}</span>
          <button
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
            className="btn-outline text-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

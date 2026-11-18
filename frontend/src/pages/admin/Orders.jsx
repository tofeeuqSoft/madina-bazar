import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';

const STATUSES = [
  'Pending', 'Confirmed', 'Processing', 'Ready for Delivery',
  'Out for Delivery', 'Delivered', 'Cancelled',
];

export default function AdminOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const page = Number(searchParams.get('page')) || 1;
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';

  useEffect(() => {
    loadOrders();
  }, [page, status, search]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (status) params.status = status;
      if (search) params.search = search;
      const { data } = await api.get('/orders', { params });
      setOrders(data.data || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId, newStatus) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      loadOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    }
  };

  const setParam = (key, value) => {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value);
    else p.delete(key);
    if (key !== 'page') p.set('page', '1');
    setSearchParams(p);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Orders ({total})</h1>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search order # or phone..."
            className="input text-sm w-48"
            defaultValue={search}
            onKeyDown={(e) => e.key === 'Enter' && setParam('search', e.target.value)}
          />
          <select
            className="input text-sm w-auto"
            value={status}
            onChange={(e) => setParam('status', e.target.value)}
          >
            <option value="">All Status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-[#12241a] rounded-xl shadow-sm border border-[#e5e2da] dark:border-[#2a3b30] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f5f0] dark:bg-white/5">
            <tr>
              <th className="text-left p-4 font-medium">Order</th>
              <th className="text-left p-4 font-medium">Customer</th>
              <th className="text-left p-4 font-medium">Total</th>
              <th className="text-left p-4 font-medium">Payment</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Date</th>
              <th className="text-left p-4 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500 dark:text-ash">Loading...</td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500 dark:text-ash">No orders found</td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30] hover:bg-[#f7f5f0] dark:hover:bg-white/5">
                  <td className="p-4">
                    <Link to={`/admin/orders/${order._id}`} className="text-primary-600 dark:text-gold-300 font-medium hover:underline">
                      #{order.orderNumber}
                    </Link>
                  </td>
                  <td className="p-4">
                    <div>{order.customer?.name || order.shippingAddress?.fullName}</div>
                    <div className="text-xs text-gray-500 dark:text-ash">{order.shippingAddress?.phone}</div>
                  </td>
                  <td className="p-4 font-medium">৳{order.totalAmount}</td>
                  <td className="p-4">
                    <div>{order.paymentMethod}</div>
                    <div className="text-xs text-gray-500 dark:text-ash">{order.paymentStatus}</div>
                  </td>
                  <td className="p-4">
                    <select
                      className="text-xs border border-[#e5e2da] dark:border-[#2a3b30] rounded px-2 py-1 bg-white dark:bg-[#0a0f0c]"
                      value={order.orderStatus}
                      onChange={(e) => updateStatus(order._id, e.target.value)}
                      disabled={['Delivered', 'Cancelled'].includes(order.orderStatus)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4 text-gray-500 dark:text-ash">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <Link to={`/admin/orders/${order._id}`} className="text-primary-600 dark:text-gold-300 text-xs hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => setParam('page', String(page - 1))}
            className="btn-outline text-sm"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm">Page {page} of {pages}</span>
          <button
            disabled={page >= pages}
            onClick={() => setParam('page', String(page + 1))}
            className="btn-outline text-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

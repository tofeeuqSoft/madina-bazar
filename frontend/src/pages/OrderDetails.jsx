import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
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

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.data);
    } catch (err) {
      toast.error('Order not found');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  const ReturnButton = ({ orderId }) => {
    const [reason, setReason] = useState('');
    const [sending, setSending] = useState(false);
    const [show, setShow] = useState(false);
    const send = async () => {
      if (!reason.trim()) return toast.error('Please tell us the reason');
      setSending(true);
      try {
        await api.post('/returns/request', { orderId, reason });
        toast.success('Return requested — our team will contact you');
        setShow(false);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Return request failed');
      } finally {
        setSending(false);
      }
    };
    if (!show) {
      return (
        <button type="button" onClick={() => setShow(true)} className="btn-outline">
          Request Return
        </button>
      );
    }
    return (
      <div className="flex flex-wrap gap-2 items-center w-full">
        <input
          className="input flex-1 min-w-[200px]"
          placeholder="Reason for return…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button type="button" onClick={send} disabled={sending} className="btn-primary">
          {sending ? 'Sending…' : 'Submit'}
        </button>
      </div>
    );
  };

  const openInvoice = async () => {
    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const res = await fetch(`${base}/invoices/${order._id}/print`, {
        credentials: 'include',
      });
      const html = await res.text();
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
      }
    } catch (err) {
      toast.error('Could not open invoice');
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    setCancelling(true);
    try {
      await api.patch(`/orders/${id}/cancel`);
      toast.success('Order cancelled');
      loadOrder();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  const decideSubstitute = async (subId, approve) => {
    if (approve && !confirm('Accept the substitute item? Totals will update.')) return;
    try {
      await api.patch(`/orders/${id}/substitute/${subId}`, { approve });
      toast.success(approve ? 'Substitute accepted' : 'Substitute declined');
      loadOrder();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to decide');
    }
  };

  if (loading) {
    return (
      <div className="container-app py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-40 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="container-app py-8 max-w-3xl">
      <Link to="/orders" className="inline-flex items-center text-sm text-gray-600 hover:text-primary-600 mb-6">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Order #{order.orderNumber}</h1>
          <p className="text-sm text-gray-500">
            {new Date(order.createdAt).toLocaleString('en-BD')}
          </p>
        </div>
        <span className={`text-sm font-medium px-3 py-1 rounded-full ${statusColors[order.orderStatus]}`}>
          {order.orderStatus}
        </span>
      </div>

      {/* Substitution proposals */}
        {(order.substitutions || []).filter((s) => s.status === 'PROPOSED').map((s) => (
          <div key={s._id} className="card p-4 mb-4 border-2 border-gold-400/60">
            <p className="font-semibold text-sm mb-1">🔄 Substitute offered</p>
            <p className="text-sm text-gray-600 mb-3">
              {s.note || 'Item unavailable'} → <b>{s.substituteName}</b> × {s.quantity}
              {s.priceDiff !== 0 && (
                <span className={s.priceDiff > 0 ? 'text-red-600' : 'text-green-600'}>
                  {' '}({s.priceDiff > 0 ? '+' : ''}৳{s.priceDiff})
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <button onClick={() => decideSubstitute(s._id, true)} className="btn-primary text-sm flex-1 py-2.5">Accept</button>
              <button onClick={() => decideSubstitute(s._id, false)} className="btn-outline text-sm flex-1 py-2.5">Decline</button>
            </div>
          </div>
        ))}

      {/* Items */}
      <div className="card p-6 mb-6">
        <h2 className="font-semibold mb-4">Items</h2>
        <div className="space-y-3">
          {order.orderItems?.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>
                {item.name} × {item.quantity}
                {item.unit && <span className="text-gray-400"> ({item.unit})</span>}
                {(item.size || item.color) && (
                  <span className="text-gray-400"> [{[item.size, item.color].filter(Boolean).join(' / ')}]</span>
                )}
              </span>
              <span className="font-medium">৳{(item.price * item.quantity).toFixed(0)}</span>
            </div>
          ))}
        </div>
        <div className="border-t mt-4 pt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>৳{order.subtotal}</span>
          </div>
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>৳{order.deliveryCharge}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount {order.couponCode && `(${order.couponCode})`}</span>
              <span>-৳{order.discount}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-2">
            <span>Total</span>
            <span className="text-primary-600">৳{order.totalAmount}</span>
          </div>
        </div>
      </div>

      {/* Shipping & Payment */}
      <div className="grid sm:grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <h2 className="font-semibold mb-3">Shipping Address</h2>
          <p className="text-sm">{order.shippingAddress?.fullName}</p>
          <p className="text-sm text-gray-600">{order.shippingAddress?.phone}</p>
          <p className="text-sm text-gray-600 mt-1">{order.shippingAddress?.address}</p>
          <p className="text-sm text-gray-600">{order.shippingAddress?.area}</p>
        </div>
        <div className="card p-6">
          <h2 className="font-semibold mb-3">Payment</h2>
          <p className="text-sm">Method: {order.paymentMethod}</p>
          <p className="text-sm">Status: {order.paymentStatus}</p>
        </div>
      </div>

      {/* Status History */}
      {order.statusHistory?.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold mb-4">Status History</h2>
          <div className="space-y-3">
            {[...order.statusHistory].reverse().map((h, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                <div>
                  <p className="font-medium">{h.status}</p>
                  <p className="text-gray-500 text-xs">
                    {new Date(h.timestamp).toLocaleString('en-BD')}
                    {h.note && ` · ${h.note}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={openInvoice} className="btn-outline">
          Print Invoice
        </button>
        {order.orderStatus === 'Pending' && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="btn-outline text-red-600 border-red-300 hover:bg-red-50"
          >
            {cancelling ? 'Cancelling...' : 'Cancel Order'}
          </button>
        )}
        {['Delivered', 'DELIVERED'].includes(order.orderStatus) && (
          <ReturnButton orderId={order._id} />
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function Track() {
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${base}/track`, { orderNumber, phone });
      setData(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Tracking failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-app py-10 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Track Your Order</h1>
      <p className="text-sm text-gray-500 mb-6">অর্ডার নম্বর ও ফোন নম্বর দিন</p>
      <form onSubmit={submit} className="space-y-3 bg-white dark:bg-[#12241a] p-5 rounded-xl border border-[#e5e2da] dark:border-[#2a3b30]">
        <input className="input" placeholder="Order number (e.g. MB…)" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required />
        <input className="input" placeholder="Phone used for the order" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Tracking…' : 'Track'}</button>
      </form>
      {data && (
        <div className="mt-6 bg-white dark:bg-[#12241a] p-5 rounded-xl border border-[#e5e2da] dark:border-[#2a3b30]">
          <p className="font-bold">Order #{data.orderNumber} <span className="text-xs font-normal text-gray-500">• {data.orderStatus}</span></p>
          {(data.shipments || []).map((s) => (
            <div key={s.shipmentNo} className="mt-4">
              <p className="text-sm"><b>{s.provider}</b> • {s.status.replace(/_/g, ' ')} • <span className="text-gray-500">{s.trackingNumber}</span></p>
              {s.rider?.name && <p className="text-xs text-gray-500">Rider: {s.rider.name} ({s.rider.phone})</p>}
              <div className="mt-2 space-y-1.5">
                {(s.history || []).map((h, i) => (
                  <p key={i} className="text-xs border-l-2 border-primary-300 pl-3">{h.status.replace(/_/g, ' ')} <span className="text-gray-400">• {h.at ? new Date(h.at).toLocaleString() : ''}</span></p>
                ))}
              </div>
            </div>
          ))}
          {(data.shipments || []).length === 0 && <p className="text-sm text-gray-500 mt-3">Shipment is being prepared.</p>}
        </div>
      )}
    </div>
  );
}

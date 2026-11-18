import { useState, useEffect } from 'react';
import { Package, Truck, Gift, Wallet, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const tk = (v) => `৳${Number(v || 0).toLocaleString()}`;

function Bar({ label, value, max, sub }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-32 truncate">{label}</span>
      <div className="flex-1 h-2.5 rounded bg-black/10 dark:bg-white/10 overflow-hidden">
        <div className="h-full bg-primary-600 dark:bg-gold-400 rounded" style={{ width: `${max ? Math.round((value / max) * 100) : 0}%` }} />
      </div>
      <span className="w-16 text-right font-medium">{value}{sub ? <span className="block text-[10px] font-normal text-gray-500">{sub}</span> : null}</span>
    </div>
  );
}

export default function DeliveryAnalytics() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/delivery/analytics/overview', { params: { from, to } });
      setData(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const t = data?.totals || {};
  const cards = [
    { label: 'Total Orders', value: t.orders ?? '…', icon: Package, bg: 'bg-primary-700' },
    { label: 'Delivery Revenue', value: loading ? '…' : tk(t.deliveryRevenue), icon: Wallet, bg: 'bg-gold-500' },
    { label: 'Paid Delivery', value: loading ? '…' : `${t.paidDelivery?.count} (${tk(t.paidDelivery?.revenue)})`, icon: Truck, bg: 'bg-success' },
    { label: 'Free Delivery', value: loading ? '…' : t.freeDelivery?.count, icon: Gift, bg: 'bg-danger' },
  ];
  const maxArea = Math.max(1, ...(data?.topAreas || []).map((a) => a.orders));
  const maxZone = Math.max(1, ...(data?.topZones || []).map((z) => z.orders));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Delivery Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-ash">Area, zone, revenue, free delivery & unavailable spots</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-auto py-1.5" />
          <span>→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input w-auto py-1.5" />
          <button onClick={load} className="btn-primary text-xs py-1.5">Apply</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-ash truncate">{c.label}</p>
                <p className="text-lg font-bold mt-1 truncate">{c.value}</p>
              </div>
              <div className={`${c.bg} p-2.5 rounded-lg text-white flex-shrink-0`}>
                <c.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {t.avgCharge != null && (
        <p className="text-xs text-gray-500 mb-4">Average charge per order: {tk(t.avgCharge)}</p>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Top Areas (most orders)</h2>
          <div className="space-y-2">
            {(data?.topAreas || []).map((a) => (
              <Bar key={a._id || a.area} label={`${a.area || 'Unknown'}${a.city ? ` (${a.city})` : ''}`} value={a.orders} max={maxArea} sub={tk(a.revenue)} />
            ))}
            {(!data?.topAreas || !data.topAreas.length) && !loading && (
              <p className="text-sm text-gray-500 text-center py-4">No data in range</p>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-3">Top Grocery Zones (most deliveries)</h2>
          <div className="space-y-2">
            {(data?.topZones || []).map((z) => (
              <Bar key={z.zone} label={z.zone} value={z.orders} max={maxZone} sub={tk(z.revenue)} />
            ))}
            {(!data?.topZones || !data.topZones.length) && !loading && (
              <p className="text-sm text-gray-500 text-center py-4">No zone deliveries yet</p>
            )}
          </div>
        </div>
      </div>

      <div className="card p-5 mt-4">
        <h2 className="font-semibold mb-1 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-danger" /> Unavailable Hotspots
        </h2>
        <p className="text-xs text-gray-500 mb-3">Where grocery checks fail most (~1km grid, 90-day log)</p>
        {(data?.unavailable || []).length === 0 && !loading ? (
          <p className="text-sm text-gray-500 text-center py-4">No misses recorded 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f7f5f0] dark:bg-white/5">
                <tr>
                  <th className="text-left p-3 font-medium">Approx Location</th>
                  <th className="text-left p-3 font-medium">Hint</th>
                  <th className="text-left p-3 font-medium">Misses</th>
                </tr>
              </thead>
              <tbody>
                {(data?.unavailable || []).map((u, i) => (
                  <tr key={i} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30]">
                    <td className="p-3">{u.lat?.toFixed(2)}, {u.lng?.toFixed(2)}</td>
                    <td className="p-3 text-gray-500">{u.hint || '—'}</td>
                    <td className="p-3 font-semibold text-danger">{u.misses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

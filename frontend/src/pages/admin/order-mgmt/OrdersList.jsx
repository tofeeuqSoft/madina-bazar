import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';
import orderAdminApi from '../../../services/orderAdmin';
import { Card, PageHead, Badge, Empty, inputCls, btnPrimary, btnGhost } from './widgets';

export default function OrdersList() {
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') || '';
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState([]);
  const [agents, setAgents] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await orderAdminApi.list({ status: status || undefined, search: search || undefined, limit: 30 });
      setOrders(r.data || []);
      setTotal(r.total || 0);
      setSel([]);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { orderAdminApi.agents().then(setAgents).catch(() => {}); }, []);

  const printPicks = async () => {
    try {
      const r = await orderAdminApi.list({ limit: 100 });
      const packable = ['Pending', 'PENDING_VERIFICATION', 'Confirmed', 'CONFIRMED', 'Processing', 'PROCESSING', 'READY_TO_SHIP'];
      const rows = (r.data || []).filter((o) => packable.includes(o.orderStatus));
      if (!rows.length) return toast.error('No packable orders');
      const agg = {};
      for (const o of rows) {
        for (const it of o.orderItems || []) {
          const k = `${it.name}|||${it.size || ''}|||${it.color || ''}`;
          agg[k] = (agg[k] || 0) + (it.quantity || 0);
        }
      }
      const pickRows = Object.entries(agg).map(([k, q], i) => {
        const [name, size, color] = k.split('|||');
        return `<tr><td>${i + 1}</td><td>${name}${size || color ? ` (${[size, color].filter(Boolean).join('/')})` : ''}</td><td><b>${q}</b></td><td>☐</td></tr>`;
      }).join('');
      const slips = rows.map((o) => `
        <div style="page-break-inside:avoid;border:1px solid #999;padding:12px;margin-top:12px">
          <b>${o.orderNumber}</b> <span style="font-family:'Libre Barcode 39',monospace;font-size:32px">*${o.orderNumber}*</span> • ${o.shippingAddress?.fullName || ''} • ${o.shippingAddress?.phone || ''}<br>
          <span style="font-size:12px">${o.shippingAddress?.address || ''}${o.deliverySlot?.label ? ` • Slot: ${o.deliverySlot.label}` : ''} • ${o.paymentMethod} ${o.paymentMethod === 'COD' ? ` collect ৳${o.totalAmount}` : ''}</span>
          <table><tr><th>#</th><th>Item</th><th>Qty</th><th>✓</th></tr>${(o.orderItems || []).map((it, i) => `<tr><td>${i + 1}</td><td>${it.name}${it.size || it.color ? ` (${[it.size, it.color].filter(Boolean).join('/')})` : ''}</td><td>${it.quantity}</td><td>☐</td></tr>`).join('')}</table>
        </div>`).join('');
      const html = `<html><head><title>Day picks (${rows.length} orders)</title><link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap" rel="stylesheet"><style>body{font-family:sans-serif;padding:24px;color:#111}.brand{font-size:14px;font-weight:bold;letter-spacing:2px;color:#0b3d2a}table{width:100%;border-collapse:collapse;margin-top:8px}td,th{border:1px solid #999;padding:6px;text-align:left;font-size:13px}h2{margin:16px 0 4px}</style></head><body><div class="brand">MADINA BAZAR</div><h1>Pick list — ${rows.length} orders</h1><table><tr><th>#</th><th>Product</th><th>Total qty</th><th>Picked</th></tr>${pickRows}</table><h2>Packing slips</h2>${slips}<script>window.print()</script></body></html>`;
      const w = window.open('', '_blank');
      if (!w) return toast.error('Popup blocked — allow popups');
      w.document.write(html);
      w.document.close();
    } catch (e) { toast.error(e.message); }
  };

  const runBulk = async (op, value, label) => {
    if (!sel.length) return toast.error('Select orders first');
    if (!confirm(`${sel.length} orders — ${label}?`)) return;
    setBusy(true);
    try {
      const r = await orderAdminApi.bulk({ ids: sel, op, value, note: `bulk ${label}` });
      if (r.failed > 0) toast.error(`Done: ${r.succeeded} ok, ${r.failed} failed (invalid transitions skipped)`);
      else toast.success(`Done: ${r.succeeded} orders updated`);
      load();
    } catch (e) { toast.error(e.response?.data?.message || e.message); }
    finally { setBusy(false); }
  };

  useEffect(() => { load(); }, [status]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { if (search !== '') load(); }, 500);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div>
      <PageHead title={status ? `${status.replace(/_/g, ' ')} Orders` : 'All Orders'} sub={`${total} orders • debounced search • indexed pagination`} />
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          <input className={inputCls} style={{ maxWidth: 320 }} placeholder="Order ID / name / phone / tracking / SKU…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
          <select className={inputCls} style={{ width: 220 }} value={status} onChange={(e) => { const v = e.target.value; if (v) setSp({ status: v }); else setSp({}); }}>
            {['', 'Pending', 'PENDING_VERIFICATION', 'Confirmed', 'Processing', 'READY_TO_SHIP', 'Shipped', 'OUT_FOR_DELIVERY', 'Delivered', 'ON_HOLD', 'Cancelled', 'FAILED'].map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
          </select>
          <button onClick={load} className={btnPrimary}>Search</button>
          <button onClick={printPicks} className={btnGhost}>🖨 Day's picks</button>
        </div>
      </Card>
      {sel.length > 0 && (
        <Card className="mb-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium">{sel.length} selected</span>
            <select
              className={inputCls} style={{ width: 200 }} defaultValue="" disabled={busy}
              onChange={(e) => { if (e.target.value) { runBulk('status', e.target.value, `status → ${e.target.value}`); e.target.value = ''; } }}
            >
              <option value="">Set status…</option>
              {['Confirmed', 'Processing', 'READY_TO_SHIP', 'Shipped', 'OUT_FOR_DELIVERY', 'Delivered', 'ON_HOLD'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              className={inputCls} style={{ width: 160 }} defaultValue="" disabled={busy}
              onChange={(e) => { if (e.target.value) { runBulk('priority', e.target.value, `priority → ${e.target.value}`); e.target.value = ''; } }}
            >
              <option value="">Set priority…</option>
              {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              className={inputCls} style={{ width: 200 }} defaultValue="" disabled={busy}
              onChange={(e) => { if (e.target.value) { runBulk('assign', { agentId: e.target.value }, 'assign agent'); e.target.value = ''; } }}
            >
              <option value="">Assign agent…</option>
              {agents.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
            <button onClick={() => setSel([])} className={btnGhost}>Clear</button>
          </div>
        </Card>
      )}
      <Card>
        {loading ? <Empty text="Loading…" /> : orders.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead><tr className="text-left text-gray-500"><th className="p-2"><input type="checkbox" checked={sel.length === orders.length && orders.length > 0} onChange={(e) => setSel(e.target.checked ? orders.map((o) => o._id) : [])} /></th><th className="p-2">Order</th><th className="p-2">Customer</th><th className="p-2">Items</th><th className="p-2">Amount</th><th className="p-2">Payment</th><th className="p-2">Type</th><th className="p-2">Status</th><th className="p-2">Priority</th><th className="p-2">Agent</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30]">
                    <td className="p-2"><input type="checkbox" checked={sel.includes(o._id)} onChange={(e) => setSel(e.target.checked ? [...sel, o._id] : sel.filter((x) => x !== o._id))} /></td>
                    <td className="p-2"><Link className="text-primary-700 dark:text-gold-300 hover:underline font-medium" to={`/admin/order-mgmt/orders/${o._id}`}>{o.orderNumber}</Link><p className="text-[10px] text-gray-400">{new Date(o.createdAt).toLocaleString()}</p></td>
                    <td className="p-2 text-xs">{o.customer?.name || o.shippingAddress?.fullName}<br /><span className="text-gray-400">{o.shippingAddress?.phone}</span></td>
                    <td className="p-2 text-xs">{(o.orderItems || []).length} items</td>
                    <td className="p-2 font-medium">৳{o.totalAmount}</td>
                    <td className="p-2 text-xs">{o.paymentStatus}<br /><span className="text-gray-400">{o.paymentMethod}</span></td>
                    <td className="p-2 text-xs">{o.deliveryType}</td>
                    <td className="p-2"><Badge value={o.orderStatus} /></td>
                    <td className="p-2"><Badge value={o.priority} /></td>
                    <td className="p-2 text-xs">{o.assignedTo?.name || <span className="text-amber-600">Unassigned</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import deliveryAdminApi from '../../../services/deliveryAdmin';
import { Card, PageHead, Badge, Empty, inputCls, btnPrimary, btnGhost } from './widgets';

export function Tracking() {
  const [sp] = useSearchParams();
  const [id, setId] = useState(sp.get('id') || '');
  const [s, setS] = useState(null);
  const load = async (e) => {
    e?.preventDefault();
    if (!id) return;
    try { setS(await deliveryAdminApi.tracking(id)); }
    catch (err) { toast.error(err.response?.data?.message || err.message); }
  };
  useEffect(() => { if (id) load(); }, []);
  const event = async (ev) => {
    try { setS(await deliveryAdminApi.shipmentEvent(id, { event: ev })); toast.success(ev); }
    catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  return (
    <div>
      <PageHead title="Tracking" sub="Unified timeline — own + courier share one status language" />
      <Card className="mb-4">
        <form onSubmit={load} className="flex gap-2"><input className={inputCls} placeholder="Shipment _id…" value={id} onChange={(e) => setId(e.target.value)} /><button className={btnPrimary}>Track</button></form>
      </Card>
      {!s ? <Card><Empty /></Card> : (
        <Card>
          <p><b>{s.shipmentNo}</b> <Badge value={s.status} /> <Badge value={s.deliveryMode} /></p>
          <p className="text-xs text-gray-500 mt-1">Order {s.order?.orderNumber} • {s.provider} • {s.trackingNumber} • COD ৳{s.codAmount} (collected ৳{s.collectedAmount})</p>
          <div className="mt-3 space-y-1.5">
            {(s.statusHistory || []).map((h, i) => <p key={i} className="text-xs border-l-2 border-primary-300 pl-3"><b>{h.status}</b> <span className="text-gray-400">• {h.timestamp ? new Date(h.timestamp).toLocaleString() : ''} {h.note}</span></p>)}
          </div>
          {s.deliveryMode === 'OWN_DELIVERY' && (
            <div className="flex gap-2 mt-4 flex-wrap">
              <button onClick={() => event('pickup')} className={btnGhost}>Pickup</button>
              <button onClick={() => event('out')} className={btnGhost}>Out for delivery</button>
              <button onClick={() => event('delivered')} className={btnPrimary}>Delivered</button>
              <button onClick={() => event('failed')} className={btnGhost}>Failed</button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export function Settlement() {
  const [d, setD] = useState(null);
  const [rows, setRows] = useState([]);
  const [fStatus, setFStatus] = useState('');
  const load = async () => {
    setD(await deliveryAdminApi.cod().catch(() => null));
    setRows((await deliveryAdminApi.codCollections(fStatus ? { status: fStatus } : {}).catch(() => ({ data: [] }))).data || []);
  };
  useEffect(() => { load(); }, [fStatus]);
  const settle = async (shipmentId, acceptVariance = false) => {
    const msg = acceptVariance ? 'Settle with SHORTAGE absorbed by company?' : 'Settle this collection?';
    if (!confirm(msg)) return;
    try {
      await deliveryAdminApi.settleCod(shipmentId, { acceptVariance });
      toast.success('Settled');
      load();
    } catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  const submit = async (shipmentId, expected) => {
    const v = prompt(`Cash submitted by rider (expected ৳${expected}):`, String(expected));
    if (v === null) return;
    try { await deliveryAdminApi.submitCod(shipmentId, Number(v)); toast.success('Submitted'); load(); }
    catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  const sum = d?.summary;
  // Rider dues: PENDING + REVIEW grouped by rider (who hasn't submitted what)
  const dues = (() => {
    const map = {};
    for (const c of rows) {
      if (!['PENDING', 'REVIEW'].includes(c.status)) continue;
      const key = c.rider?._id || c.rider || 'unknown';
      if (!map[key]) map[key] = { name: c.rider?.user?.name || 'Unknown rider', expected: 0, submitted: 0, count: 0 };
      map[key].expected += c.expectedAmount || 0;
      map[key].submitted += c.submittedAmount || 0;
      map[key].count += 1;
    }
    return Object.values(map).sort((a, b) => (b.expected - b.submitted) - (a.expected - a.submitted));
  })();
  const totalDue = dues.reduce((s, x) => s + (x.expected - x.submitted), 0);
  return (
    <div>
      <PageHead title="COD Settlement" sub="Customer charge vs actual cost tracked separately — margin visible" />
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <Card><p className="text-xs text-gray-500">Pending settlement</p><p className="text-xl font-bold">৳{sum?.pendingSettlement?.collected ?? '…'}</p></Card>
        <Card><p className="text-xs text-gray-500">Settled</p><p className="text-xl font-bold">৳{sum?.settled?.collected ?? '…'}</p></Card>
        <Card><p className="text-xs text-gray-500">Delivery margin (own+ext)</p><p className="text-xl font-bold">৳{(d?.margins || []).reduce((s, m) => s + (m.margin || 0), 0).toFixed(0)}</p></Card>
      </div>
      {dues.length > 0 && (
        <Card className="mb-4">
          <h3 className="font-semibold text-sm mb-2">💰 Rider dues <span className="font-normal text-gray-500">(unsubmitted cash • total <b className="text-red-600">৳{totalDue}</b>)</span></h3>
          {dues.map((x, i) => (
            <p key={i} className="text-xs py-1.5 border-t border-black/5 flex justify-between gap-2">
              <span><b>{x.name}</b> <span className="text-gray-400">({x.count} shipment{x.count > 1 ? 's' : ''})</span></span>
              <span className="whitespace-nowrap">due <b className="text-red-600">৳{x.expected - x.submitted}</b> <span className="text-gray-400">(exp ৳{x.expected} • got ৳{x.submitted})</span></span>
            </p>
          ))}
        </Card>
      )}
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2 items-center mb-2">
          <h3 className="font-semibold text-sm">Collections</h3>
          <select className={inputCls} style={{ width: 180 }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            {['', 'PENDING', 'SUBMITTED', 'REVIEW', 'SETTLED'].map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
          </select>
        </div>
        {rows.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead><tr className="text-left text-gray-500"><th className="p-2">Rider</th><th className="p-2">Expected</th><th className="p-2">Submitted</th><th className="p-2">Variance</th><th className="p-2">Status</th><th className="p-2">Action</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c._id} className="border-t border-black/5">
                    <td className="p-2 text-xs">{c.rider?.user?.name || '—'}</td>
                    <td className="p-2">৳{c.expectedAmount}</td>
                    <td className="p-2">৳{c.submittedAmount}</td>
                    <td className={`p-2 font-semibold ${c.variance < 0 ? 'text-red-600' : ''}`}>{c.variance > 0 ? '+' : ''}{c.variance}</td>
                    <td className="p-2"><Badge value={c.status} /></td>
                    <td className="p-2"><div className="flex gap-1 flex-wrap">
                      {['PENDING'].includes(c.status) && <button onClick={() => submit(c.shipment, c.expectedAmount)} className={btnGhost}>Submit</button>}
                      {['SUBMITTED'].includes(c.status) && <button onClick={() => settle(c.shipment)} className={btnPrimary}>Settle</button>}
                      {['REVIEW'].includes(c.status) && <button onClick={() => settle(c.shipment, true)} className={btnDanger}>Absorb short & settle</button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card>
        <h3 className="font-semibold text-sm mb-2">Margin by mode</h3>
        {(d?.margins || []).map((m) => <p key={m._id} className="text-xs py-1.5 border-t border-black/5 flex justify-between"><span>{m._id} ({m.count})</span><b>rev ৳{m.revenue} • cost ৳{m.cost} • margin ৳{m.margin}</b></p>)}
      </Card>
    </div>
  );
}

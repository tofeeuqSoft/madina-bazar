import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import deliveryAdminApi from '../../../services/deliveryAdmin';
import { Card, PageHead, Badge, Empty, inputCls, btnPrimary, btnGhost } from './widgets';

function PathRow({ courier, onSave }) {
  const [paths, setPaths] = useState(courier.apiPaths || {});
  const save = async () => {
    try { await deliveryAdminApi.updateCourier(courier._id, { apiPaths: paths }); toast.success(`${courier.code} paths saved`); onSave(); }
    catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  return (
    <div className="py-2 border-t border-black/5">
      <p className="text-xs font-semibold mb-1">{courier.code}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
        {['createShipment', 'cancelShipment', 'status', 'tracking', 'pickup', 'return'].map((k) => (
          <input key={k} className={inputCls} placeholder={`/${k}`} value={paths[k] || ''} onChange={(e) => setPaths({ ...paths, [k]: e.target.value })} />
        ))}
      </div>
      <button onClick={save} className={`${btnGhost} mt-1.5`}>Save paths</button>
    </div>
  );
}

export default function Couriers() {
  const [rows, setRows] = useState([]);
  const [perf, setPerf] = useState([]);
  const [cred, setCred] = useState({ providerId: '', environment: 'LIVE', baseUrl: '', apiKey: '', apiSecret: '', merchantId: '' });
  const load = async () => {
    setRows((await deliveryAdminApi.couriers().catch(() => [])) || []);
    setPerf((await deliveryAdminApi.courierPerformance().catch(() => [])) || []);
  };
  useEffect(() => { load(); }, []);
  const act = async (fn, msg) => {
    try { await fn(); toast.success(msg); load(); }
    catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  return (
    <div>
      <PageHead title="External Courier Providers" sub="Priority selection • fallback chain • secrets stay server-side (masked)" />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          {rows.length === 0 ? <Empty /> : rows.map((c) => (
            <div key={c._id} className="py-3 border-t border-black/5 text-sm">
              <div className="flex justify-between items-center gap-2">
                <span><b>{c.code}</b> — P{c.priority} <Badge value={c.status} /></span>
                <span className="flex gap-1">
                  <button onClick={() => act(() => deliveryAdminApi.courierStatus(c._id, c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'), 'Status updated')} className={btnGhost}>{c.status === 'ACTIVE' ? 'Disable' : 'Enable'}</button>
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">COD {c.codSupported ? '✓' : '✗'} • Return {c.returnSupported ? '✓' : '✗'} • Tracking {c.trackingSupported ? '✓' : '✗'} • Cancel {c.cancellationSupported ? '✓' : '✗'} • Fallback {c.fallbackAllowed ? '✓' : '✗'} • Success {(c.successRate * 100).toFixed(0)}%</p>
              <div className="flex gap-1 mt-2 items-center">
                <input className={inputCls} style={{ width: 70 }} type="number" min="1" defaultValue={c.priority} id={`prio-${c._id}`} />
                <button onClick={() => act(() => deliveryAdminApi.updateCourier(c._id, { priority: Number(document.getElementById(`prio-${c._id}`).value) }), 'Priority saved')} className={btnGhost}>Save priority</button>
              </div>
            </div>
          ))}
          <h3 className="font-semibold text-sm mt-4 mb-1">API paths (from official docs — empty = disabled)</h3>
          {rows.map((c) => (
            <PathRow key={c._id} courier={c} onSave={load} />
          ))}
          <h3 className="font-semibold text-sm mt-4 mb-1">Performance (shipments)</h3>
          {perf.map((p) => <p key={p._id} className="text-xs py-1 border-t border-black/5 flex justify-between"><span>{p._id}</span><b>{p.count} • {p.delivered} delivered • margin ৳{Math.round(p.margin || 0)}</b></p>)}
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">Provider Credentials (server-only)</h3>
          <div className="space-y-2">
            <select className={inputCls} value={cred.providerId} onChange={(e) => setCred({ ...cred, providerId: e.target.value })}>
              <option value="">Select provider…</option>
              {rows.map((c) => <option key={c._id} value={c._id}>{c.code}</option>)}
            </select>
            <select className={inputCls} value={cred.environment} onChange={(e) => setCred({ ...cred, environment: e.target.value })}><option>LIVE</option><option>SANDBOX</option></select>
            <input className={inputCls} placeholder="Base URL (from official docs)" value={cred.baseUrl} onChange={(e) => setCred({ ...cred, baseUrl: e.target.value })} />
            <input className={inputCls} placeholder="API key" value={cred.apiKey} onChange={(e) => setCred({ ...cred, apiKey: e.target.value })} />
            <input className={inputCls} placeholder="API secret" value={cred.apiSecret} onChange={(e) => setCred({ ...cred, apiSecret: e.target.value })} />
            <input className={inputCls} placeholder="Merchant ID" value={cred.merchantId} onChange={(e) => setCred({ ...cred, merchantId: e.target.value })} />
            <button onClick={() => act(() => deliveryAdminApi.saveCredential(cred), 'Credentials saved (encrypted)')} className={btnPrimary}>Save (encrypted)</button>
            <p className="text-[11px] text-gray-500">Keys are AES-encrypted at rest and never returned by any API.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

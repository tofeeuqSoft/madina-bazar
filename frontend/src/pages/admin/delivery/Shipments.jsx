import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import deliveryAdminApi from '../../../services/deliveryAdmin';
import { Card, PageHead, Badge, Empty, inputCls, btnPrimary, btnGhost, btnDanger } from './widgets';

export function Shipments({ fixedMode = '', fixedStatus = '' }) {
  const [sp] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(fixedStatus || '');
  const [provider, setProvider] = useState('');
  const load = async () => {
    const r = await deliveryAdminApi.shipments({ mode: fixedMode || undefined, status: status || undefined, provider: provider || undefined }).catch(() => ({ data: [] }));
    setRows(r.data || []);
  };
  useEffect(() => { load(); }, [status, provider, fixedMode]);
  const act = async (fn, msg) => {
    try { await fn(); toast.success(msg); load(); }
    catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  const title = fixedMode === 'OWN_DELIVERY' ? (fixedStatus ? 'Pending Assignment' : 'Own Delivery Orders') : 'Shipments';
  return (
    <div>
      <PageHead title={title} sub="One unified lifecycle for own-rider + courier shipments" />
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          <select className={inputCls} style={{ width: 200 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {['CREATED', 'PENDING_ASSIGNMENT', 'ASSIGNED', 'PENDING_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className={inputCls} style={{ width: 200 }} value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="">All providers</option>
            {['OWN_RIDER', 'STEADFAST', 'PATHAO', 'CARIBEE', 'PAPERFLY'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <button onClick={load} className={btnPrimary}>Filter</button>
        </div>
      </Card>
      <Card>
        {rows.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead><tr className="text-left text-gray-500"><th className="p-2">Shipment</th><th className="p-2">Order</th><th className="p-2">Mode/Provider</th><th className="p-2">Rider/Tracking</th><th className="p-2">COD</th><th className="p-2">Status</th><th className="p-2">Actions</th></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s._id} className="border-t border-black/5">
                    <td className="p-2 font-medium">{s.shipmentNo}{(s.attempt || 1) > 1 && <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gold-400/15 text-gold-700 dark:text-gold-300">try {s.attempt}</span>}<p className="text-[10px] text-gray-400">{s.zoneName} {s.areaName}</p></td>
                    <td className="p-2 text-xs">{s.order?.orderNumber}</td>
                    <td className="p-2"><Badge value={s.deliveryMode} /><p className="text-[10px] text-gray-400 mt-1">{s.provider}</p></td>
                    <td className="p-2 text-xs">{s.rider ? s.rider?.user?.name || 'rider' : (s.trackingNumber || '—')}</td>
                    <td className="p-2 text-xs">৳{s.codAmount}{s.codSettled ? ' ✓' : ''}</td>
                    <td className="p-2"><Badge value={s.status} /></td>
                    <td className="p-2"><div className="flex gap-1 flex-wrap">
                      <Link to={`/admin/delivery/tracking?id=${s._id}`} className={btnGhost}>Track</Link>
                      {s.deliveryMode === 'OWN_DELIVERY' && ['CREATED', 'PENDING_ASSIGNMENT'].includes(s.status) && <button onClick={() => act(() => deliveryAdminApi.shipmentEvent(s._id, { event: 'pickup' }), 'Picked up')} className={btnGhost}>Pickup</button>}
                      <button onClick={() => act(() => deliveryAdminApi.retryShipment(s._id), 'Retried (idempotent)')} className={btnGhost}>Retry</button>
                      {s.status === 'FAILED' && <button onClick={() => { if (confirm(`Return ${s.shipmentNo} to origin?`)) act(() => deliveryAdminApi.rtoShipment(s._id, 'Manual RTO from shipments'), 'Return to origin requested'); }} className={btnGhost}>RTO</button>}
                      {s.awaitingConfirm && <button onClick={() => { if (confirm(`Confirm courier booking for ${s.shipmentNo} (${s.provider})?`)) act(() => deliveryAdminApi.confirmDispatch(s._id), 'Dispatch confirmed'); }} className={btnPrimary}>Confirm</button>}
                      {s.deliveryMode === 'EXTERNAL_COURIER' && !['DELIVERED', 'RETURNED', 'CANCELLED'].includes(s.status) && <button onClick={() => { if (confirm(`Pull ${s.shipmentNo} back to own riders?`)) act(() => deliveryAdminApi.pullBack(s._id), 'Pulled back to own network'); }} className={btnGhost}>Pull back</button>}
                      {!['DELIVERED', 'CANCELLED'].includes(s.status) && <button onClick={() => act(() => deliveryAdminApi.cancelShipment(s._id, 'Admin cancel'), 'Cancelled')} className={btnDanger}>Cancel</button>}
                    </div></td>
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

export function OwnOrders() {
  return <Shipments fixedMode="OWN_DELIVERY" />;
}
export function PendingAssignment() {
  return <Shipments fixedMode="OWN_DELIVERY" fixedStatus="PENDING_ASSIGNMENT" />;
}
export { Shipments as AllShipments };

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import deliveryAdminApi from '../../../services/deliveryAdmin';
import { Card, PageHead, Badge, Empty, inputCls, btnPrimary, btnGhost } from './widgets';
import { ZoneAssignment, ShiftsAttendance, Settlements } from './RiderOps';

export default function Riders() {
  const [rows, setRows] = useState([]);
  const [cap, setCap] = useState(null);
  const [perf, setPerf] = useState([]);
  const [form, setForm] = useState({ userId: '', vehicleType: 'MOTORBIKE', maxDailyOrders: 30 });
  const load = async () => {
    setRows((await deliveryAdminApi.riders({}).catch(() => ({ data: [] }))).data || []);
    setCap(await deliveryAdminApi.riderCapacity().catch(() => null));
    setPerf((await deliveryAdminApi.riderPerformance().catch(() => [])) || []);
  };
  useEffect(() => { load(); }, []);
  const create = async (e) => {
    e.preventDefault();
    try { await deliveryAdminApi.createRider({ ...form, maxDailyOrders: Number(form.maxDailyOrders) }); toast.success('Rider onboarded'); load(); }
    catch (err) { toast.error(err.response?.data?.message || err.message); }
  };
  const toggle = async (r) => {
    try { await deliveryAdminApi.patchRider(r._id, { isAvailable: !r.isAvailable }); load(); }
    catch (e) { toast.error(e.message); }
  };
  const [tab, setTab] = useState('riders');

  return (
    <div>
      <PageHead title="Own Rider Management" sub={`Capacity today: ${cap?.remaining ?? '…'} of ${cap?.capacity ?? '…'} (${cap?.riders ?? 0} riders)`} />
      <div className="flex gap-2 mb-4 flex-wrap">
        {[['riders', 'Riders'], ['zones', 'Zone Assignment'], ['shifts', 'Shifts & Attendance'], ['settle', 'COD & Settlement']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={tab === k ? btnPrimary : btnGhost}>{l}</button>
        ))}
      </div>
      {tab === 'zones' && <ZoneAssignment />}
      {tab === 'shifts' && <ShiftsAttendance />}
      {tab === 'settle' && <Settlements />}
      {tab !== 'riders' ? null : (
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          {rows.length === 0 ? <Empty text="No riders yet — onboard via user ID" /> : rows.map((r) => (
            <div key={r._id} className="py-2 border-t border-black/5 text-sm flex justify-between items-center gap-2">
              <span><b>{r.user?.name}</b> {r.user?.phone} • {r.vehicleType} • {r.currentAssignedOrders}/{r.maxDailyOrders} <Badge value={r.isAvailable ? 'ACTIVE' : 'INACTIVE'} /></span>
              <button onClick={() => toggle(r)} className={btnGhost}>{r.isAvailable ? 'Set unavailable' : 'Set available'}</button>
            </div>
          ))}
          <h3 className="font-semibold text-sm mt-4 mb-1">Performance</h3>
          {perf.map((p, i) => <p key={i} className="text-xs py-1 border-t border-black/5 flex justify-between"><span>{p.name} ({(p.zones || []).join(', ')})</span><b>{p.delivered} ✓ • {p.failed} ✗ • {p.successRate}% • ৳{p.codCollected}</b></p>)}
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">Onboard Rider</h3>
          <form onSubmit={create} className="space-y-2">
            <input className={inputCls} required placeholder="User _id (becomes DELIVERY_RIDER)" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} />
            <select className={inputCls} value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}>{['BICYCLE', 'MOTORBIKE', 'VAN', 'OTHER'].map((v) => <option key={v}>{v}</option>)}</select>
            <input className={inputCls} type="number" min="1" placeholder="Max daily orders" value={form.maxDailyOrders} onChange={(e) => setForm({ ...form, maxDailyOrders: e.target.value })} />
            <button className={btnPrimary}>Onboard</button>
          </form>
        </Card>
      </div>
      )}
    </div>
  );
}

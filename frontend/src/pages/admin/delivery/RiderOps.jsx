import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import deliveryAdminApi from '../../../services/deliveryAdmin';
import api from '../../../services/api';
import { Card, Empty, inputCls, btnPrimary, btnGhost } from './widgets';

export function ZoneAssignment() {
  const [zones, setZones] = useState([]);
  const [riders, setRiders] = useState([]);
  const [form, setForm] = useState({ riderId: '', zoneId: '', priority: 1, maxDailyOrders: 30 });
  const [plan, setPlan] = useState(null);
  const load = async () => {
    setZones((await api.get('/grocery-zones').then((r) => r.data.data).catch(() => [])) || []);
    setRiders(((await deliveryAdminApi.riders({}).catch(() => ({ data: [] }))).data) || []);
  };
  useEffect(() => { load(); }, []);
  const assign = async (e) => {
    e.preventDefault();
    try { await deliveryAdminApi.assignZone(form); toast.success('Zone assigned'); }
    catch (err) { toast.error(err.response?.data?.message || err.message); }
  };
  const checkPlan = async (zoneId, expected) => {
    try { setPlan(await deliveryAdminApi.capacityPlan(zoneId, expected)); }
    catch (e) { toast.error(e.message); }
  };
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <h3 className="font-semibold text-sm mb-2">Assign Rider → Zone</h3>
        <form onSubmit={assign} className="space-y-2">
          <select className={inputCls} required value={form.riderId} onChange={(e) => setForm({ ...form, riderId: e.target.value })}>
            <option value="">Rider…</option>{riders.map((r) => <option key={r._id} value={r._id}>{r.user?.name}</option>)}
          </select>
          <select className={inputCls} required value={form.zoneId} onChange={(e) => setForm({ ...form, zoneId: e.target.value })}>
            <option value="">Zone…</option>{zones.map((z) => <option key={z._id} value={z._id}>{z.name} ({z.status})</option>)}
          </select>
          <button className={btnPrimary}>Assign</button>
        </form>
      </Card>
      <Card>
        <h3 className="font-semibold text-sm mb-2">Capacity plan (new-zone rider shortage)</h3>
        {zones.map((z) => (
          <div key={z._id} className="flex justify-between items-center text-xs py-1.5 border-t border-black/5">
            <span>{z.name}</span>
            <button onClick={() => checkPlan(z._id, z.riderCapacity || 150)} className={btnGhost}>Check</button>
          </div>
        ))}
        {plan && (
          <div className={`mt-2 p-3 rounded-lg text-xs ${plan.shortage > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
            <p className="font-semibold">{plan.zone}: {plan.recommendation}</p>
            <p>Expected {plan.expectedDailyOrders}/day • capacity {plan.totalCapacity} • utilization {plan.utilization}% • riders {plan.currentRiders}/{plan.requiredRiders}</p>
          </div>
        )}
      </Card>
    </div>
  );
}

export function ShiftsAttendance() {
  const [shifts, setShifts] = useState([]);
  const [att, setAtt] = useState([]);
  const [form, setForm] = useState({ name: '', startHour: 9, endHour: 17 });
  const load = async () => {
    setShifts((await deliveryAdminApi.shifts().catch(() => [])) || []);
    setAtt(((await deliveryAdminApi.attendance({}).catch(() => ({ data: [] }))).data) || []);
  };
  useEffect(() => { load(); }, []);
  const create = async (e) => {
    e.preventDefault();
    try { await deliveryAdminApi.createShift({ ...form, startHour: Number(form.startHour), endHour: Number(form.endHour) }); toast.success('Shift created'); load(); }
    catch (err) { toast.error(err.response?.data?.message || err.message); }
  };
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <h3 className="font-semibold text-sm mb-2">Shifts</h3>
        {shifts.length === 0 ? <Empty text="No shifts — create Morning/Evening" /> : shifts.map((s) => <p key={s._id} className="text-xs py-1.5 border-t border-black/5">{s.name}: {s.startHour}:00–{s.endHour}:00 {s.isActive ? '✅' : '❌'}</p>)}
        <form onSubmit={create} className="flex gap-2 mt-3">
          <input className={inputCls} required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={inputCls} type="number" min="0" max="23" value={form.startHour} onChange={(e) => setForm({ ...form, startHour: e.target.value })} />
          <input className={inputCls} type="number" min="1" max="24" value={form.endHour} onChange={(e) => setForm({ ...form, endHour: e.target.value })} />
          <button className={btnPrimary}>Add</button>
        </form>
      </Card>
      <Card>
        <h3 className="font-semibold text-sm mb-2">Attendance</h3>
        {att.length === 0 ? <Empty /> : att.slice(0, 20).map((a) => <p key={a._id} className="text-xs py-1 border-t border-black/5">{a.date} • {a.rider?.user?.name} • {a.status} • {a.deliveryCount} deliveries</p>)}
      </Card>
    </div>
  );
}

export function Settlements() {
  const [rows, setRows] = useState([]);
  const [cod, setCod] = useState([]);
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState({ riderId: '', from: '', to: '' });
  const load = async () => {
    setRows((await deliveryAdminApi.listSettlements({}).catch(() => [])) || []);
    setCod(((await deliveryAdminApi.codCollections({}).catch(() => ({ data: [] }))).data) || []);
  };
  useEffect(() => { load(); }, []);
  const act = async (fn, msg) => {
    try { await fn(); toast.success(msg); load(); }
    catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold text-sm mb-2">COD handover (expected → collected → submitted, variance flagged)</h3>
        {cod.length === 0 ? <Empty /> : cod.slice(0, 15).map((c) => (
          <div key={c._id} className="text-xs py-1.5 border-t border-black/5 flex justify-between items-center gap-2">
            <span>{c.rider?.user?.name} • exp ৳{c.expectedAmount} • got ৳{c.collectedAmount} • submitted ৳{c.submittedAmount} {c.variance < 0 && <b className="text-red-600">(Δ {c.variance})</b>} • {c.status}</span>
            {c.status === 'PENDING' && <button onClick={() => act(() => deliveryAdminApi.submitCod(c.shipment, c.collectedAmount), 'Submitted')} className={btnGhost}>Submit</button>}
          </div>
        ))}
      </Card>
      <Card>
        <h3 className="font-semibold text-sm mb-2">Settlements (pay model separate from delivery charges)</h3>
        <div className="flex gap-2 mb-3 flex-wrap">
          <input className={inputCls} style={{ maxWidth: 220 }} placeholder="Rider _id" value={form.riderId} onChange={(e) => setForm({ ...form, riderId: e.target.value })} />
          <input className={inputCls} style={{ maxWidth: 160 }} type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
          <input className={inputCls} style={{ maxWidth: 160 }} type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
          <button onClick={() => deliveryAdminApi.previewSettlement(form).then(setPreview).catch((e) => toast.error(e.message))} className={btnGhost}>Preview</button>
          <button onClick={() => act(() => deliveryAdminApi.createSettlement(form), 'Settlement drafted')} className={btnPrimary}>Create</button>
        </div>
        {preview && <p className="text-xs mb-2">Preview: {preview.deliveries} deliveries • base ৳{preview.baseAmount} + incentive ৳{preview.incentive} = <b>৳{preview.totalAmount}</b> ({preview.model}) • COD variance {preview.codVariance}</p>}
        {rows.map((s) => (
          <div key={s._id} className="text-xs py-1.5 border-t border-black/5 flex justify-between items-center gap-2">
            <span>{s.rider?.user?.name} • {s.model} • ৳{s.totalAmount} • {s.status}</span>
            {s.status === 'DRAFT' && <button onClick={() => act(() => deliveryAdminApi.approveSettlement(s._id), 'Approved')} className={btnGhost}>Approve</button>}
          </div>
        ))}
      </Card>
    </div>
  );
}

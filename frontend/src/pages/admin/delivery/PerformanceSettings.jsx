import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import deliveryAdminApi from '../../../services/deliveryAdmin';
import { Card, PageHead, Empty, Badge, inputCls, btnPrimary, btnGhost } from './widgets';

export function Performance() {
  const [r, setR] = useState(null);
  useEffect(() => { deliveryAdminApi.reports({}).then(setR).catch(() => {}); }, []);
  return (
    <div>
      <PageHead title="Delivery Performance & Reports" sub="Margins • network growth • courier vs own success" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card><h3 className="font-semibold text-sm mb-2">Margin by mode</h3>{(r?.margins || []).map((m) => <p key={m._id} className="text-xs py-1 flex justify-between"><span>{m._id} ({m.count})</span><b>৳{m.revenue} − ৳{m.cost} = ৳{m.margin}</b></p>)}</Card>
        <Card><h3 className="font-semibold text-sm mb-2">Own-network growth</h3>{(r?.growth || []).map((m) => <p key={m.month} className="text-xs py-1 flex justify-between"><span>{m.month}</span><b>{m.own}/{m.total} ({m.ownPct}%)</b></p>)}</Card>
      </div>
    </div>
  );
}

export function Slots() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ name: '', label: '', startHour: '10', endHour: '12', capacity: 50, cutoffHour: '', applicableTo: 'ALL' });
  const load = async () => setRows((await deliveryAdminApi.slots().catch(() => [])) || []);
  useEffect(() => { load(); }, []);
  const create = async (e) => {
    e.preventDefault();
    try {
      await deliveryAdminApi.createSlot({ ...form, startHour: Number(form.startHour), endHour: Number(form.endHour), capacity: Number(form.capacity), cutoffHour: form.cutoffHour === '' ? null : Number(form.cutoffHour) });
      toast.success('Slot created');
      setForm({ name: '', label: '', startHour: '10', endHour: '12', capacity: 50, cutoffHour: '', applicableTo: 'ALL' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
  };
  const toggle = async (s) => {
    try { await deliveryAdminApi.patchSlot(s._id, { isActive: !s.isActive }); load(); }
    catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  return (
    <div>
      <PageHead title="Delivery Slots" sub="Time windows + per-day capacity — full slots reject at checkout, never overbook" />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          {rows.length === 0 ? <Empty /> : rows.map((s) => (
            <div key={s._id} className="py-2 border-t border-black/5 text-sm flex flex-wrap justify-between gap-2 items-center">
              <span><b>{s.name}</b> <span className="text-gray-500">{s.label} • {s.startHour}:00–{s.endHour}:00 • cap {s.capacity}{s.cutoffHour != null ? ` • cutoff ${s.cutoffHour}:00` : ''} • {s.applicableTo}</span> <Badge value={s.isActive ? 'ACTIVE' : 'INACTIVE'} /></span>
              <button onClick={() => toggle(s)} className={btnGhost}>{s.isActive ? 'Disable' : 'Enable'}</button>
            </div>
          ))}
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">New Slot</h3>
          <form onSubmit={create} className="space-y-2">
            <input className={inputCls} required placeholder="Name (Morning)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={inputCls} placeholder="Label (10AM–12PM)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} required type="number" min="0" max="23" placeholder="Start hr" value={form.startHour} onChange={(e) => setForm({ ...form, startHour: e.target.value })} />
              <input className={inputCls} required type="number" min="1" max="24" placeholder="End hr" value={form.endHour} onChange={(e) => setForm({ ...form, endHour: e.target.value })} />
            </div>
            <input className={inputCls} required type="number" min="1" placeholder="Capacity/day" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            <input className={inputCls} type="number" min="0" max="23" placeholder="Same-day cutoff hr (empty = none)" value={form.cutoffHour} onChange={(e) => setForm({ ...form, cutoffHour: e.target.value })} />
            <select className={inputCls} value={form.applicableTo} onChange={(e) => setForm({ ...form, applicableTo: e.target.value })}>
              {['ALL', 'GROCERY', 'NATIONWIDE'].map((v) => <option key={v}>{v}</option>)}
            </select>
            <button className={btnPrimary}>Create Slot</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function DeliverySettings() {
  const [s, setS] = useState(null);
  useEffect(() => { deliveryAdminApi.settings().then(setS).catch(() => {}); }, []);
  const save = async (e) => {
    e.preventDefault();
    try { await deliveryAdminApi.saveSettings(s); toast.success('Delivery policy saved'); }
    catch (err) { toast.error(err.response?.data?.message || err.message); }
  };
  if (!s) return <Empty text="Loading…" />;
  return (
    <div>
      <PageHead title="Delivery Settings" sub="Capacity policy • courier selection • own-delivery master switch" />
      <Card>
        <form onSubmit={save} className="space-y-3 max-w-xl">
          <label className="text-xs">Rider capacity full →<select className={inputCls} value={s.capacityFullPolicy} onChange={(e) => setS({ ...s, capacityFullPolicy: e.target.value })}>{['WAIT', 'REASSIGN', 'USE_EXTERNAL_COURIER', 'ADMIN_REVIEW'].map((v) => <option key={v}>{v}</option>)}</select></label>
          <label className="text-xs">Courier selection<select className={inputCls} value={s.courierSelectionMode} onChange={(e) => setS({ ...s, courierSelectionMode: e.target.value })}>{['ADMIN_PRIORITY', 'COST', 'SUCCESS_RATE', 'SPEED', 'MANUAL'].map((v) => <option key={v}>{v}</option>)}</select></label>
          <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={s.ownDeliveryEnabled} onChange={(e) => setS({ ...s, ownDeliveryEnabled: e.target.checked })} /> Own delivery enabled</label>
          <label className="text-xs">Rider pay model<select className={inputCls} value={s.riderPayModel} onChange={(e) => setS({ ...s, riderPayModel: e.target.value })}>{['FIXED_SALARY', 'PER_DELIVERY', 'ZONE_BASED', 'MIXED'].map((v) => <option key={v}>{v}</option>)}</select></label>
          <label className="text-xs">Per-delivery rate ৳<input className={inputCls} type="number" min="0" value={s.riderPerDeliveryRate} onChange={(e) => setS({ ...s, riderPerDeliveryRate: Number(e.target.value) })} /></label>
          <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={s.otpRequired} onChange={(e) => setS({ ...s, otpRequired: e.target.checked })} /> OTP proof required</label>
          <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={s.gpsRequired} onChange={(e) => setS({ ...s, gpsRequired: e.target.checked })} /> GPS proof required (radius {s.gpsRadiusM}m)</label>
          <button className={btnPrimary}>Save Policy</button>
        </form>
      </Card>
    </div>
  );
}

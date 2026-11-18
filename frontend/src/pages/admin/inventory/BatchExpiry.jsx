import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import inventoryApi from '../../../services/inventory';
import { Card, PageHead, Badge, Empty, inputCls, btnPrimary } from './widgets';
import { HubShell, useTabDirty } from './hubUtils';
import { ReturnedStock } from './Receiving';

export function Batches({ onDirty }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ batchNumber: '', product: '', quantity: '', expiryDate: '' });
  useTabDirty(onDirty, Object.values(form).some((v) => String(v || '').trim() !== ''));
  const load = async () => setRows((await inventoryApi.batches({}).catch(() => ({ data: [] }))).data || []);
  useEffect(() => { load(); }, []);
  const create = async (e) => {
    e.preventDefault();
    try {
      await inventoryApi.createBatch({ ...form, quantity: Number(form.quantity), remainingQuantity: Number(form.quantity) });
      toast.success('Batch created'); load();
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
  };
  return (
    <div>
      <PageHead title="Batch Management" sub="FEFO-ready — earliest expiry picks first for grocery/expiry-sensitive goods" />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          {rows.length === 0 ? <Empty /> : rows.map((b) => (
            <p key={b._id} className="text-xs py-2 border-t border-black/5 flex justify-between"><span><b>{b.batchNumber}</b> • {b.product?.name} • {b.remainingQuantity}/{b.quantity} • exp {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : '—'}</span><Badge value={b.expiryStatus} /></p>
          ))}
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">New Batch</h3>
          <form onSubmit={create} className="space-y-2">
            <input className={inputCls} required placeholder="Batch no" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
            <input className={inputCls} required placeholder="Product _id" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
            <input className={inputCls} required type="number" placeholder="Qty" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <input className={inputCls} type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            <button className={btnPrimary}>Create Batch</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function Expiry() {
  const [d, setD] = useState(null);
  useEffect(() => { inventoryApi.expiry(30).then(setD).catch(() => {}); }, []);
  return (
    <div>
      <PageHead title="Expiry Management" sub={`Threshold: ${d?.thresholdDays ?? 30} days (configurable in Settings)`} />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card><h3 className="font-semibold text-sm mb-2 text-red-600">Expired ({d?.expired?.length ?? 0})</h3>{(d?.expired || []).map((b) => <p key={b._id} className="text-xs py-1 border-t border-black/5">{b.batchNumber} • {b.product?.name}</p>)}</Card>
        <Card><h3 className="font-semibold text-sm mb-2 text-amber-600">Expiring Soon ({d?.expiringSoon?.length ?? 0})</h3>{(d?.expiringSoon || []).map((b) => <p key={b._id} className="text-xs py-1 border-t border-black/5">{b.batchNumber} • {b.product?.name} • {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : ''}</p>)}</Card>
      </div>
    </div>
  );
}

export function DamagedLost({ onDirty }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ productId: '', quantity: '', reason: '', kind: 'damaged' });
  useTabDirty(onDirty, [form.productId, form.quantity, form.reason].some((v) => String(v || '').trim() !== ''));
  const load = async () => setRows((await inventoryApi.damaged({}).catch(() => ({ data: [] }))).data || []);
  useEffect(() => { load(); }, []);
  const save = async (e) => {
    e.preventDefault();
    try {
      await inventoryApi.recordDamageLoss(form.kind, { ...form, quantity: Number(form.quantity) });
      toast.success('Recorded'); load();
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
  };
  return (
    <div>
      <PageHead title="Damaged / Lost Stock" sub="Separate buckets with reason + evidence — never silently written off" />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">{rows.length === 0 ? <Empty /> : rows.map((m) => <p key={m._id} className="text-xs py-1.5 border-t border-black/5">{m.type} {m.quantity} • {m.product?.name} • {m.reason} • {new Date(m.createdAt).toLocaleString()}</p>)}</Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">Record</h3>
          <form onSubmit={save} className="space-y-2">
            <select className={inputCls} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="damaged">DAMAGED</option><option value="lost">LOST</option></select>
            <input className={inputCls} required placeholder="Product _id" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} />
            <input className={inputCls} required type="number" min="1" placeholder="Qty" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <input className={inputCls} required placeholder="Reason (mandatory)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            <button className={btnPrimary}>Record</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function BatchesHub() {
  return (
    <HubShell
      tabs={[
        { key: 'batches', label: 'Batches', to: '/admin/inventory/batches', perm: ['inventory.batch.view'], element: <Batches /> },
        { key: 'expiry', label: 'Expiry', to: '/admin/inventory/batches?tab=expiry', perm: ['inventory.expiry.view'], element: <Expiry /> },
      ]}
    />
  );
}

export function ReturnsHub() {
  return (
    <HubShell
      tabs={[
        { key: 'returns', label: 'Returned', to: '/admin/inventory/returns', perm: ['inventory.return.view'], element: <ReturnedStock /> },
        { key: 'damaged', label: 'Damaged / Lost', to: '/admin/inventory/returns?tab=damaged', perm: ['inventory.damage.view'], element: <DamagedLost /> },
      ]}
    />
  );
}

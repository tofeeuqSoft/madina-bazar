import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import inventoryApi from '../../../services/inventory';
import { Card, PageHead, Badge, Empty, inputCls, btnPrimary, btnGhost } from './widgets';
import { HubShell, useTabDirty } from './hubUtils';
import { PurchaseReceiving } from './Receiving';

export function Warehouses({ onDirty }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ name: '', code: '', district: '', phone: '' });
  useTabDirty(onDirty, Object.values(form).some((v) => String(v || '').trim() !== ''));
  const load = async () => setRows((await inventoryApi.warehouses().catch(() => [])) || []);
  useEffect(() => { load(); }, []);
  const create = async (e) => {
    e.preventDefault();
    try { await inventoryApi.createWarehouse(form); toast.success('Warehouse created'); setForm({ name: '', code: '', district: '', phone: '' }); load(); }
    catch (err) { toast.error(err.response?.data?.message || err.message); }
  };
  return (
    <div>
      <PageHead title="Warehouses" sub="ACTIVE / INACTIVE / MAINTENANCE — deactivation only, never hard-delete" />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          {rows.length === 0 ? <Empty /> : rows.map((w) => (
            <p key={w._id} className="text-sm py-2 border-t border-black/5 flex justify-between"><span><b>{w.name}</b> ({w.code}) {w.isDefault && '⭐'} • {w.district}</span><Badge value={w.status} /></p>
          ))}
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">New Warehouse</h3>
          <form onSubmit={create} className="space-y-2">
            <input className={inputCls} required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={inputCls} placeholder="Code (auto)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <input className={inputCls} placeholder="District" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
            <input className={inputCls} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <button className={btnPrimary}>Create</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function Transfers({ onDirty }) {
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ product: '', quantity: '', fromWarehouse: '', toWarehouse: '', reason: '' });
  useTabDirty(onDirty, Object.values(form).some((v) => String(v || '').trim() !== ''));
  const load = async () => {
    setRows((await inventoryApi.transfers({}).catch(() => ({ data: [] }))).data || []);
    setWarehouses((await inventoryApi.warehouses().catch(() => [])) || []);
  };
  useEffect(() => { load(); }, []);
  const act = async (fn, msg) => {
    try { await fn(); toast.success(msg); load(); }
    catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  const create = async (e) => {
    e.preventDefault();
    await act(() => inventoryApi.createTransfer({ items: [{ product: form.product, quantity: Number(form.quantity) }], fromWarehouse: form.fromWarehouse, toWarehouse: form.toWarehouse, reason: form.reason }), 'Transfer requested');
  };
  return (
    <div>
      <PageHead title="Warehouse Transfer" sub="REQUESTED → APPROVED (stock out) → RECEIVED (stock in) — both sides recorded" />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          {rows.length === 0 ? <Empty /> : rows.map((t) => (
            <div key={t._id} className="py-2 border-t border-black/5 text-sm flex flex-wrap justify-between gap-2 items-center">
              <span><b>{t.transferNo}</b> {t.fromWarehouse?.code} → {t.toWarehouse?.code} • {(t.items || []).length} items <Badge value={t.status} /></span>
              <span className="flex gap-1">
                {t.status === 'REQUESTED' && <button onClick={() => act(() => inventoryApi.approveTransfer(t._id), 'Approved — stock moved out')} className={btnPrimary}>Approve</button>}
                {['APPROVED', 'IN_TRANSIT'].includes(t.status) && <button onClick={() => act(() => inventoryApi.receiveTransfer(t._id), 'Received')} className={btnPrimary}>Receive</button>}
                {t.status === 'REQUESTED' && <button onClick={() => act(() => inventoryApi.cancelTransfer(t._id), 'Cancelled')} className={btnGhost}>Cancel</button>}
              </span>
            </div>
          ))}
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">New Transfer</h3>
          <form onSubmit={create} className="space-y-2">
            <input className={inputCls} required placeholder="Product _id" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
            <input className={inputCls} required type="number" min="1" placeholder="Qty" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <select className={inputCls} required value={form.fromWarehouse} onChange={(e) => setForm({ ...form, fromWarehouse: e.target.value })}><option value="">From…</option>{warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select>
            <select className={inputCls} required value={form.toWarehouse} onChange={(e) => setForm({ ...form, toWarehouse: e.target.value })}><option value="">To…</option>{warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select>
            <input className={inputCls} placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            <button className={btnPrimary}>Request Transfer</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function WarehouseHub() {
  return (
    <HubShell
      tabs={[
        { key: 'warehouses', label: 'Warehouses', to: '/admin/inventory/warehouses', perm: ['inventory.warehouse.view'], element: <Warehouses /> },
        { key: 'transfers', label: 'Transfers', to: '/admin/inventory/warehouses?tab=transfers', perm: ['inventory.transfer.view'], element: <Transfers /> },
        { key: 'receiving', label: 'Receiving', to: '/admin/inventory/warehouses?tab=receiving', perm: ['inventory.purchase.receive'], element: <PurchaseReceiving /> },
      ]}
    />
  );
}

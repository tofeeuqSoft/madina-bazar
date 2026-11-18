import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import inventoryApi from '../../../services/inventory';
import { Card, PageHead, Badge, Empty, inputCls, btnPrimary, btnGhost } from './widgets';

export default function Adjustments() {
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ productId: '', warehouseId: '', quantity: '', adjustmentType: 'COUNT_CORRECTION', reason: '' });
  const load = async () => {
    setRows((await inventoryApi.adjustments({}).catch(() => ({ data: [] }))).data || []);
    setWarehouses((await inventoryApi.warehouses().catch(() => [])) || []);
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await inventoryApi.createAdjustment({ ...form, quantity: Number(form.quantity) });
      toast.success('Adjustment saved (large ones go to PENDING approval)');
      setForm({ productId: '', warehouseId: '', quantity: '', adjustmentType: 'COUNT_CORRECTION', reason: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
  };
  const decide = async (id, fn, msg) => {
    try { await fn(id); toast.success(msg); load(); }
    catch (e) { toast.error(e.response?.data?.message || e.message); }
  };

  return (
    <div>
      <PageHead title="Stock Adjustment" sub="Reason mandatory • large adjustments need approval • approver ≠ creator" />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          {rows.length === 0 ? <Empty /> : rows.map((a) => (
            <div key={a._id} className="py-2 border-t border-black/5 text-sm flex flex-wrap justify-between gap-2 items-center">
              <span>{a.product?.name} <b>{a.quantity > 0 ? `+${a.quantity}` : a.quantity}</b> <span className="text-xs text-gray-400">({a.adjustmentType})</span> <Badge value={a.status} /></span>
              {a.status === 'PENDING' && (
                <span className="flex gap-1">
                  <button onClick={() => decide(a._id, inventoryApi.approveAdjustment, 'Approved')} className={btnPrimary}>Approve</button>
                  <button onClick={() => decide(a._id, inventoryApi.rejectAdjustment, 'Rejected')} className={btnGhost}>Reject</button>
                </span>
              )}
            </div>
          ))}
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">New Adjustment</h3>
          <form onSubmit={create} className="space-y-2">
            <input className={inputCls} required placeholder="Product _id" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} />
            <select className={inputCls} value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
              <option value="">Default warehouse</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
            <input className={inputCls} required type="number" placeholder="+10 / -5" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <select className={inputCls} value={form.adjustmentType} onChange={(e) => setForm({ ...form, adjustmentType: e.target.value })}>
              {['COUNT_CORRECTION', 'DAMAGED', 'LOST', 'FOUND', 'DATA_CORRECTION', 'OTHER'].map((t) => <option key={t}>{t}</option>)}
            </select>
            <input className={inputCls} required placeholder="Reason (mandatory)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            <button className={btnPrimary}>Save Adjustment</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import inventoryApi from '../../../services/inventory';
import useAuthStore from '../../../store/authStore';
import { can } from '../../../utils/permissions';
import { Card, PageHead, Empty, inputCls, btnGhost, btnPrimary, btnDanger } from './widgets';

export function Movements() {
  const [rows, setRows] = useState([]);
  const [type, setType] = useState('');
  const load = () => {
    inventoryApi.movements({ type: type || undefined, limit: 50 }).then((r) => setRows(r.data || [])).catch(() => {});
  };
  useEffect(() => { load(); }, [type]);
  return (
    <div>
      <PageHead title="Stock Movement" sub="Immutable ledger — PURCHASE / SALE / RETURN / TRANSFER / ADJUSTMENT / DAMAGED / LOST / EXPIRED" />
      <Card className="mb-4">
        <select className={inputCls} style={{ maxWidth: 260 }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {['PURCHASE', 'SALE', 'RETURN', 'RESTOCK', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGED', 'LOST', 'EXPIRED'].map((t) => <option key={t}>{t}</option>)}
        </select>
      </Card>
      <ArchivePanel onDone={load} />
      <Card>
        {rows.length === 0 ? <Empty /> : (
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-500"><th className="p-2">Time</th><th className="p-2">Type</th><th className="p-2">Product</th><th className="p-2">Qty</th><th className="p-2">Before→After</th><th className="p-2">Ref</th></tr></thead>
            <tbody>{rows.map((m) => <tr key={m._id} className="border-t border-black/5"><td className="p-2">{new Date(m.createdAt).toLocaleString()}</td><td className="p-2">{m.type}</td><td className="p-2">{m.product?.name} ({m.sku})</td><td className="p-2 font-bold">{m.quantity}</td><td className="p-2">{m.beforeQuantity}→{m.afterQuantity}</td><td className="p-2" title={m.referenceType && m.referenceId ? `${m.referenceType}:${m.referenceId}` : ''}>{m.referenceType ? `${m.referenceType}:${String(m.referenceId || '').slice(-6) || '—'}` : '—'}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// Soft-archive: old rows leave the live list but stay in DB (restorable,
// still counted in reports). Forced order: preview → CSV download → archive.
function ArchivePanel({ onDone }) {
  const { user } = useAuthStore();
  const [days, setDays] = useState(365);
  const [preview, setPreview] = useState(null);
  const [exported, setExported] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    inventoryApi.settings().then((s) => { if (s?.movementArchiveAfterDays) setDays(s.movementArchiveAfterDays); }).catch(() => {});
  }, []);
  if (!can(user, 'inventory.settings.update')) return null;

  const doPreview = async () => {
    try { setPreview(await inventoryApi.previewArchive({ olderThanDays: Number(days) })); setExported(false); }
    catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  const doDownload = async () => {
    try {
      const blob = await inventoryApi.exportMovements({ olderThanDays: Number(days) });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `movements-archive-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setExported(true);
      toast.success('CSV saved — archive unlocked');
    } catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  const doArchive = async () => {
    if (!window.confirm(`Archive ${preview?.eligible ?? 0} rows older than ${days} days? They leave the live list but stay in DB (restorable).`)) return;
    setBusy(true);
    try {
      const r = await inventoryApi.runArchive({ olderThanDays: Number(days), exportConfirmed: true });
      toast.success(`Archived ${r.archived} rows (soft — restorable)`);
      setPreview(null); setExported(false); onDone?.();
    } catch (e) { toast.error(e.response?.data?.message || e.message); }
    finally { setBusy(false); }
  };

  return (
    <Card className="mb-4">
      <h3 className="font-semibold text-sm mb-1">History Archive (soft — never delete)</h3>
      <p className="text-[11px] text-gray-500 mb-2">Min 90 days. Rows leave the live list but stay in DB + reports. Every run is audit-logged.</p>
      <div className="flex flex-wrap gap-2 items-center">
        <input className={inputCls} style={{ maxWidth: 140 }} type="number" min={90} value={days} onChange={(e) => { setDays(e.target.value); setPreview(null); setExported(false); }} />
        <span className="text-xs text-gray-500">days+</span>
        <button onClick={doPreview} className={btnGhost}>1. Preview</button>
        {preview && <span className="text-xs">Eligible: <b>{preview.eligible}</b></span>}
        <button onClick={doDownload} disabled={!preview} className={btnGhost}>2. Download CSV</button>
        <button onClick={doArchive} disabled={!preview || !exported || busy} className={btnDanger}>3. Archive {preview ? `(${preview.eligible})` : ''}</button>
      </div>
    </Card>
  );
}

export function Reservations() {
  const [rows, setRows] = useState([]);
  const load = async () => setRows((await inventoryApi.reservations({}).catch(() => ({ data: [] }))).data || []);
  useEffect(() => { load(); }, []);
  const release = async (id) => {
    try { await inventoryApi.releaseReservation(id); toast.success('Released'); load(); }
    catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  return (
    <div>
      <PageHead title="Stock Reservation" sub="Order holds that prevent overselling — release on cancellation" />
      <Card>
        {rows.length === 0 ? <Empty text="No reservations" /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th className="p-2">Ref</th><th className="p-2">Product</th><th className="p-2">Qty</th><th className="p-2">Status</th><th className="p-2">Action</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r._id} className="border-t border-black/5"><td className="p-2 text-xs">{r.referenceId}</td><td className="p-2">{r.product?.name}</td><td className="p-2">{r.quantity}</td><td className="p-2 text-xs">{r.status}</td><td className="p-2">{r.status === 'ACTIVE' && <button onClick={() => release(r._id)} className={btnGhost}>Release</button>}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

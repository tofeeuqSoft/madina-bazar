import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import inventoryApi from '../../../services/inventory';
import useAuthStore from '../../../store/authStore';
import { can } from '../../../utils/permissions';
import { Card, PageHead, Badge, Empty, inputCls, btnPrimary, btnGhost, btnDanger } from './widgets';
import { HubShell } from './hubUtils';
import { Valuation } from './StockPages';

export function Alerts() {
  const { user } = useAuthStore();
  const [rows, setRows] = useState([]);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = async () => setRows((await inventoryApi.alerts({}).catch(() => ({ data: [] }))).data || []);
  useEffect(() => { load(); }, []);
  const runReconcile = async () => {
    if (!window.confirm('Run integrity check now? Read-only — raises alerts for mismatches, fixes nothing automatically.')) return;
    setBusy(true);
    try {
      const r = await inventoryApi.reconcile();
      setReport(r);
      toast.success(`Checked ${r.checked}, issues ${r.issues.length}`);
      load();
    } catch (e) { toast.error(e.response?.data?.message || e.message); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <PageHead title="Stock Alerts" sub="LOW / OUT / EXPIRING / LARGE-CHANGE — extensible to Email/SMS/Push/WhatsApp" />
      {can(user, 'inventory.settings.update') && (
        <Card className="mb-4">
          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={runReconcile} disabled={busy} className={btnPrimary}>{busy ? 'Checking…' : 'Run integrity check'}</button>
            {report && <span className="text-xs text-gray-500">Checked {report.checked} • issues <b className={report.issues.length ? 'text-red-600' : 'text-green-600'}>{report.issues.length}</b> (nightly auto-run 03:00)</span>}
          </div>
          {report?.issues?.length > 0 && (
            <div className="mt-2 text-xs max-h-40 overflow-y-auto">
              {report.issues.map((i, idx) => <p key={idx} className="py-1 border-t border-black/5"><b>{i.kind}</b> {i.sku} — {i.message} {i.alerted ? '' : '(already alerted <24h)'}</p>)}
            </div>
          )}
        </Card>
      )}
      <Card>
        {rows.length === 0 ? <Empty text="No alerts 🎉" /> : rows.map((a) => (
          <p key={a._id} className="text-xs py-2 border-t border-black/5 flex justify-between gap-2">
            <span><Badge value={a.type} /> {a.message} <span className="text-gray-400">• {new Date(a.createdAt).toLocaleString()}</span></span>
            {a.status === 'ACTIVE' && <button onClick={() => inventoryApi.ackAlert(a._id, 'ACKNOWLEDGED').then(load)} className={btnGhost}>Ack</button>}
          </p>
        ))}
      </Card>
    </div>
  );
}

export function Reports() {
  const [r, setR] = useState(null);
  useEffect(() => { inventoryApi.reports({}).then(setR).catch(() => {}); }, []);
  return (
    <div>
      <PageHead title="Inventory Reports" sub="Movement • fast/slow movers • export is permission-gated" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card><h3 className="font-semibold text-sm mb-2">By movement type</h3>{(r?.byType || []).map((x) => <p key={x._id} className="text-xs py-1 flex justify-between"><span>{x._id}</span><b>{x.count} × ({x.qty})</b></p>)}</Card>
        <Card><h3 className="font-semibold text-sm mb-2">Fast moving (by SALE qty)</h3>{(r?.fastMoving || []).map((x) => <p key={x._id} className="text-xs py-1">Product {String(x._id).slice(-6)} — sold {x.sold}</p>)}</Card>
      </div>
    </div>
  );
}

export function AuditPage() {
  const [rows, setRows] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const load = () => {
    inventoryApi.audit(showArchived ? { archived: true } : {}).then(setRows).catch(() => {});
  };
  useEffect(() => { load(); }, [showArchived]);
  return (
    <div>
      <PageHead title="Inventory Audit Logs" sub="Immutable — every sensitive action with actor, IP, old/new values" />
      <AuditArchivePanel onDone={load} />
      <Card className="mb-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived history (restorable, read-only)
          </label>
          <button
            onClick={async () => {
              try {
                const blob = await inventoryApi.exportAudit(showArchived ? { archived: true } : {});
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                toast.success('Audit CSV downloaded');
              } catch (e) { toast.error(e.response?.data?.message || e.message); }
            }}
            className={btnGhost}
          >
            ⬇ Export CSV
          </button>
        </div>
      </Card>
      <Card>
        {rows.length === 0 ? <Empty /> : (
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-500"><th className="p-2">Time</th><th className="p-2">Action</th><th className="p-2">Actor</th><th className="p-2">Entity</th><th className="p-2">Reason</th></tr></thead>
            <tbody>{rows.map((l) => <tr key={l._id} className="border-t border-black/5"><td className="p-2">{new Date(l.createdAt).toLocaleString()}</td><td className="p-2">{l.action}</td><td className="p-2">{l.actor?.name} ({l.actorRole}/{l.performedByType})</td><td className="p-2">{l.entityType}</td><td className="p-2">{l.reason}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

export function FinanceHub() {
  return (
    <HubShell
      tabs={[
        { key: 'valuation', label: 'Valuation', to: '/admin/inventory/valuation', perm: ['inventory.valuation.view'], element: <Valuation /> },
        { key: 'reports', label: 'Reports', to: '/admin/inventory/valuation?tab=reports', perm: ['inventory.report.view'], element: <Reports /> },
      ]}
    />
  );
}

// Soft-archive for audit history: min 365 days retention, export-first enforced.
// The run itself is logged as a fresh live entry, so the chain never breaks.
function AuditArchivePanel({ onDone }) {
  const { user } = useAuthStore();
  const [days, setDays] = useState(730);
  const [preview, setPreview] = useState(null);
  const [exported, setExported] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    inventoryApi.settings().then((s) => { if (s?.auditArchiveAfterDays) setDays(s.auditArchiveAfterDays); }).catch(() => {});
  }, []);
  if (!can(user, 'inventory.settings.update')) return null;

  const doPreview = async () => {
    try { setPreview(await inventoryApi.previewAuditArchive({ olderThanDays: Number(days) })); setExported(false); }
    catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  const doDownload = async () => {
    try {
      const blob = await inventoryApi.exportAudit({ olderThanDays: Number(days) });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `audit-archive-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setExported(true);
      toast.success('CSV saved — archive unlocked');
    } catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  const doArchive = async () => {
    if (!window.confirm(`Archive ${preview?.eligible ?? 0} audit rows older than ${days} days? Content stays in DB (restorable).`)) return;
    setBusy(true);
    try {
      const r = await inventoryApi.runAuditArchive({ olderThanDays: Number(days), exportConfirmed: true });
      toast.success(`Archived ${r.archived} rows (soft — restorable)`);
      setPreview(null); setExported(false); onDone?.();
    } catch (e) { toast.error(e.response?.data?.message || e.message); }
    finally { setBusy(false); }
  };

  return (
    <Card className="mb-4">
      <h3 className="font-semibold text-sm mb-1">Audit History Archive (soft — never delete)</h3>
      <p className="text-[11px] text-gray-500 mb-2">Min 365 days retention. Content stays in DB + viewable via “Show archived”. The run itself is audit-logged.</p>
      <div className="flex flex-wrap gap-2 items-center">
        <input className={inputCls} style={{ maxWidth: 140 }} type="number" min={365} value={days} onChange={(e) => { setDays(e.target.value); setPreview(null); setExported(false); }} />
        <span className="text-xs text-gray-500">days+</span>
        <button onClick={doPreview} className={btnGhost}>1. Preview</button>
        {preview && <span className="text-xs">Eligible: <b>{preview.eligible}</b></span>}
        <button onClick={doDownload} disabled={!preview} className={btnGhost}>2. Download CSV</button>
        <button onClick={doArchive} disabled={!preview || !exported || busy} className={btnDanger}>3. Archive {preview ? `(${preview.eligible})` : ''}</button>
      </div>
    </Card>
  );
}

export function SettingsPage() {
  const [s, setS] = useState(null);
  useEffect(() => { inventoryApi.settings().then(setS).catch(() => {}); }, []);
  const save = async (e) => {
    e.preventDefault();
    try { await inventoryApi.saveSettings(s); toast.success('Settings saved'); }
    catch (err) { toast.error(err.response?.data?.message || err.message); }
  };
  if (!s) return <Empty text="Loading…" />;
  return (
    <div>
      <PageHead title="Inventory Settings" sub="Valuation • fulfillment • thresholds — rules live in DB, never hard-coded" />
      <Card>
        <form onSubmit={save} className="space-y-3 max-w-xl">
          <label className="text-xs">Valuation method<select className={inputCls} value={s.valuationMethod} onChange={(e) => setS({ ...s, valuationMethod: e.target.value })}><option>FIFO</option><option>WEIGHTED_AVERAGE</option><option>STANDARD_COST</option></select></label>
          <label className="text-xs">Fulfillment (FIFO / FEFO)<select className={inputCls} value={s.fulfillmentMethod} onChange={(e) => setS({ ...s, fulfillmentMethod: e.target.value })}><option>FIFO</option><option>FEFO</option></select></label>
          <label className="text-xs">Expiry-soon days<input className={inputCls} type="number" value={s.expirySoonDays} onChange={(e) => setS({ ...s, expirySoonDays: Number(e.target.value) })} /></label>
          <label className="text-xs">Adjustment approval threshold<input className={inputCls} type="number" value={s.adjustmentApprovalThreshold} onChange={(e) => setS({ ...s, adjustmentApprovalThreshold: Number(e.target.value) })} /></label>
          <label className="text-xs">Audit archive after (days, min 365)<input className={inputCls} type="number" min={365} value={s.auditArchiveAfterDays ?? 730} onChange={(e) => setS({ ...s, auditArchiveAfterDays: Number(e.target.value) })} /></label>
          <button className={btnPrimary}>Save Settings</button>
        </form>
      </Card>
    </div>
  );
}

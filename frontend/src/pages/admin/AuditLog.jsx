import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const ACTION_COLOR = {
  ZONE_CREATE: 'bg-success/15 text-success',
  ZONE_UPDATE: 'bg-primary-700/10 text-primary-700 dark:text-gold-300',
  ZONE_STATUS: 'bg-gold-400/15 text-gold-700 dark:text-gold-300',
  ZONE_DELETE: 'bg-danger/10 text-danger',
  AREA_CREATE: 'bg-success/15 text-success',
  AREA_UPDATE: 'bg-primary-700/10 text-primary-700 dark:text-gold-300',
  AREA_STATUS: 'bg-gold-400/15 text-gold-700 dark:text-gold-300',
  AREA_DELETE: 'bg-danger/10 text-danger',
  NATIONWIDE_SAVE: 'bg-primary-700/10 text-primary-700 dark:text-gold-300',
  NATIONWIDE_DELETE: 'bg-danger/10 text-danger',
  FREE_DELIVERY_UPDATE: 'bg-gold-400/15 text-gold-700 dark:text-gold-300',
};

const ENTITIES = ['', 'GroceryZone', 'DeliveryArea', 'NationwideCharge', 'FreeDelivery'];

export default function AuditLog() {
  const [list, setList] = useState([]);
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const { data } = await api.get('/delivery/audit', { params: { entity: entity || undefined, page: p, limit: 20 } });
      setList(data.data || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setPage(data.page || p);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, [entity]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-sm text-gray-500 dark:text-ash">Ke ki change korlo — zone, area, charge, free delivery</p>
        </div>
        <select value={entity} onChange={(e) => setEntity(e.target.value)} className="input w-auto text-sm">
          <option value="">All entities</option>
          {ENTITIES.filter(Boolean).map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f5f0] dark:bg-white/5">
            <tr>
              <th className="text-left p-3 font-medium">When</th>
              <th className="text-left p-3 font-medium">Who</th>
              <th className="text-left p-3 font-medium">Action</th>
              <th className="text-left p-3 font-medium">Target</th>
              <th className="text-left p-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">No audit entries yet</td></tr>
            ) : (
              list.map((a) => (
                <tr key={a._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30]">
                  <td className="p-3 text-xs whitespace-nowrap text-gray-500">
                    {new Date(a.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{a.actorName || a.actor?.name || '—'}</div>
                    <div className="text-[11px] text-gray-500">{a.actorRole || a.actor?.role || ''}</div>
                  </td>
                  <td className="p-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${ACTION_COLOR[a.action] || 'bg-black/5 dark:bg-white/10'}`}>
                      {a.action?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{a.entityName || '—'}</div>
                    <div className="text-[11px] text-gray-500">{a.entity}</div>
                  </td>
                  <td className="p-3 text-xs text-gray-500 max-w-[220px] truncate" title={JSON.stringify(a.details || {})}>
                    {a.details && Object.keys(a.details).length
                      ? Object.entries(a.details).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ')
                      : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm">
        <p className="text-gray-500">Total {total}</p>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => load(page - 1)} className="btn-outline text-xs">← Prev</button>
          <span className="px-2 py-1">Page {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => load(page + 1)} className="btn-outline text-xs">Next →</button>
        </div>
      </div>

      <div className="card p-4 mt-4 text-xs text-gray-500 dark:text-ash">
        <b>Role guide:</b> Super Admin → full access · Delivery Manager → delivery only (view + create + update) ·
        Support (Sub Admin) → Super Admin Users page theke <b>DELIVERY_AREA_VIEW</b> + <b>REPORT_VIEW</b> dile view-only pabe.
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import supportApi from '../../../services/support';
import { Card, PageHead, StatusBadge, Empty, inputCls, btnPrimary } from './widgets';

const STATUSES = ['', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_INTERNAL', 'RESOLVED', 'CLOSED', 'REOPENED'];

export default function Tickets() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ customer: '', subject: '', description: '', priority: 'MEDIUM', category: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await supportApi.tickets({ status: status || undefined, search: search || undefined, limit: 50 });
      setTickets(res.data || []);
      setTotal(res.total || 0);
    } catch { /* empty */ } finally { setLoading(false); }
  };

  useEffect(() => { load(); supportApi.categories().then(setCats).catch(() => {}); }, [status]);

  const create = async (e) => {
    e.preventDefault();
    await supportApi.createTicket({ ...form, category: form.category || undefined });
    setShowNew(false);
    setForm({ customer: '', subject: '', description: '', priority: 'MEDIUM', category: '' });
    load();
  };

  return (
    <div>
      <PageHead
        title={status ? `${status.replace(/_/g, ' ')} Tickets` : 'All Tickets'}
        sub={`${total} tickets • Human agents reply here today; AI_AGENT sender type reserved for future`}
        right={<button onClick={() => setShowNew(!showNew)} className={btnPrimary}>+ New Ticket</button>}
      />

      {showNew && (
        <Card className="mb-4">
          <form onSubmit={create} className="grid md:grid-cols-2 gap-3">
            <input className={inputCls} placeholder="Customer ID (or leave for manual)" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} />
            <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Category…</option>
              {cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <input className={inputCls} placeholder="Subject *" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <select className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p}>{p}</option>)}
            </select>
            <textarea className={`${inputCls} md:col-span-2`} rows={3} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="md:col-span-2"><button className={btnPrimary}>Create Ticket</button></div>
          </form>
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <select className={inputCls} style={{ width: 220 }} value={status} onChange={(e) => { const v = e.target.value; if (v) setParams({ status: v }); else setParams({}); }}>
            {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
          </select>
          <input className={inputCls} style={{ maxWidth: 260 }} placeholder="Search ticket ID / subject…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
          <button onClick={load} className={btnPrimary}>Search</button>
        </div>
      </Card>

      <Card>
        {loading ? <Empty text="Loading…" /> : tickets.length === 0 ? <Empty text="No tickets found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500"><th className="p-2">Ticket</th><th className="p-2">Subject</th><th className="p-2">Customer</th><th className="p-2">Status</th><th className="p-2">Priority</th><th className="p-2">Agent</th></tr></thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30]">
                    <td className="p-2"><Link className="text-primary-700 dark:text-gold-300 hover:underline" to={`/admin/support/tickets/${t._id}`}>{t.ticketId}</Link></td>
                    <td className="p-2">{t.subject}</td>
                    <td className="p-2">{t.customer?.name || '—'}</td>
                    <td className="p-2"><StatusBadge value={t.status} /></td>
                    <td className="p-2"><StatusBadge value={t.priority} /></td>
                    <td className="p-2 text-xs">{t.assignedAgent?.name || <span className="text-amber-600">Unassigned</span>}</td>
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

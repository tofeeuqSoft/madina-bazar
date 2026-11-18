import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import supportApi from '../../../services/support';
import { Card, PageHead, StatusBadge, Empty, inputCls } from './widgets';

const MODES = {
  orders: { title: 'Order Support', hint: 'Read-only order context via existing Order API — no financial recalculation here.' },
  payments: { title: 'Payment Support', hint: 'View transactions only. Modifications go through authorized Payment/Finance APIs.' },
  delivery: { title: 'Delivery Support', hint: 'Uses existing Delivery Management APIs — no duplicated pricing logic.' },
  returns: { title: 'Return & Refund Support', hint: 'Request → Review → Approval → Refund. Approval is permission-gated.' },
  products: { title: 'Product Support', hint: 'Wrong / damaged / missing / warranty issues with linked product info.' },
  complaints: { title: 'Complaints', hint: 'High + Urgent priority tickets across all categories.' },
};

export default function IssueBoard({ mode = 'orders' }) {
  const meta = MODES[mode] || MODES.orders;
  const [tickets, setTickets] = useState([]);
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState('');

  useEffect(() => {
    supportApi.categories().then(setCats).catch(() => {});
  }, []);

  useEffect(() => {
    const params = { limit: 50 };
    if (mode === 'complaints') params.priority = undefined;
    if (cat) params.category = cat;
    supportApi.tickets(params).then((r) => {
      let list = r.data || [];
      if (mode === 'complaints') list = list.filter((t) => ['HIGH', 'URGENT'].includes(t.priority));
      setTickets(list);
    }).catch(() => {});
  }, [mode, cat]);

  return (
    <div>
      <PageHead title={meta.title} sub={meta.hint} />
      <Card className="mb-4">
        <select className={inputCls} style={{ maxWidth: 280 }} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </Card>
      <Card>
        {tickets.length === 0 ? <Empty /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th className="p-2">Ticket</th><th className="p-2">Subject</th><th className="p-2">Status</th><th className="p-2">Priority</th></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30]">
                  <td className="p-2"><Link className="text-primary-700 hover:underline" to={`/admin/support/tickets/${t._id}`}>{t.ticketId}</Link></td>
                  <td className="p-2">{t.subject}</td>
                  <td className="p-2"><StatusBadge value={t.status} /></td>
                  <td className="p-2"><StatusBadge value={t.priority} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

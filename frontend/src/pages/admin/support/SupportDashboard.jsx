import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import supportApi from '../../../services/support';
import { Card, PageHead, Empty } from './widgets';

export default function SupportDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supportApi.dashboard().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const cards = data?.cards || {};
  const metrics = data?.metrics || {};
  const charts = data?.charts || {};

  const cardDefs = [
    { label: 'New Tickets', value: cards.newTickets, link: '/admin/support/tickets?status=OPEN' },
    { label: 'Open Tickets', value: cards.openTickets, link: '/admin/support/tickets' },
    { label: 'Pending', value: cards.pendingTickets, link: '/admin/support/tickets?status=IN_PROGRESS' },
    { label: 'High Priority', value: cards.highPriority, link: '/admin/support/complaints' },
    { label: 'Urgent', value: cards.urgentTickets, link: '/admin/support/complaints' },
    { label: 'Unassigned', value: cards.unassignedTickets, link: '/admin/support/tickets' },
    { label: 'Active Chats', value: cards.activeChats, link: '/admin/support/chat' },
    { label: 'Resolved Today', value: cards.resolvedToday, link: '/admin/support/tickets?status=RESOLVED' },
    { label: 'Satisfaction', value: cards.customerSatisfaction ? `${cards.customerSatisfaction}★` : '—', link: '/admin/support/feedback' },
  ];

  return (
    <div>
      <PageHead
        title="Customer Support Dashboard"
        sub="Live overview — Human agents operate today, AI layer stays ready for future"
        right={<Link to="/admin/support/tickets" className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-700 text-white">View Tickets</Link>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        {cardDefs.map((c) => (
          <Link key={c.label} to={c.link}>
            <Card>
              <p className="text-xs text-gray-500 dark:text-ash">{c.label}</p>
              <p className="text-2xl font-bold mt-1">{loading ? '…' : c.value ?? 0}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <h3 className="font-semibold mb-3 text-sm">Today&apos;s Metrics</h3>
          <ul className="text-sm space-y-2">
            <li className="flex justify-between"><span>Conversations</span><b>{metrics.todaysConversations ?? 0}</b></li>
            <li className="flex justify-between"><span>Complaints</span><b>{metrics.todaysComplaints ?? 0}</b></li>
            <li className="flex justify-between"><span>Return requests</span><b>{metrics.returnRequests ?? 0}</b></li>
            <li className="flex justify-between"><span>Refund requests</span><b>{metrics.refundRequests ?? 0}</b></li>
          </ul>
        </Card>
        <Card>
          <h3 className="font-semibold mb-3 text-sm">Tickets by Status</h3>
          {(charts.byStatus || []).length === 0 ? <Empty text="No tickets yet" /> : (
            <ul className="text-sm space-y-2">
              {charts.byStatus.map((s) => (
                <li key={s._id} className="flex justify-between"><span>{s._id}</span><b>{s.count}</b></li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h3 className="font-semibold mb-3 text-sm">Tickets by Priority</h3>
          {(charts.byPriority || []).length === 0 ? <Empty text="No tickets yet" /> : (
            <ul className="text-sm space-y-2">
              {charts.byPriority.map((s) => (
                <li key={s._id} className="flex justify-between"><span>{s._id}</span><b>{s.count}</b></li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold mb-3 text-sm">Tickets — last 14 days</h3>
        {(charts.byDay || []).length === 0 ? <Empty text="No activity yet" /> : (
          <div className="flex items-end gap-1 h-28">
            {charts.byDay.map((d) => {
              const max = Math.max(...charts.byDay.map((x) => x.count), 1);
              return (
                <div key={d._id} title={`${d._id}: ${d.count}`} className="flex-1 bg-primary-600/80 rounded-t" style={{ height: `${Math.max(8, (d.count / max) * 100)}%` }} />
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

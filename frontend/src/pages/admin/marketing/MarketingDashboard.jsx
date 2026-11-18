import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import marketingApi from '../../../services/marketing';
import { Card, PageHead, Bars } from './widgets';

export default function MarketingDashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { marketingApi.dashboard().then(setD).catch(() => {}); }, []);
  const s = d?.sales || {};
  const split = d?.split || {};

  const cards = [
    ['Revenue ৳', s.revenue, '/admin/marketing/sales'],
    ['Orders', s.orders, '/admin/marketing/sales'],
    ['Avg Order ৳', s.aov, '/admin/marketing/sales'],
    ['Customers', s.customers, '/admin/marketing/customers'],
    ['Growth %', d?.growthPct != null ? `${d.growthPct}%` : '…', '/admin/marketing/sales'],
    ['New Revenue ৳', split.newRevenue, '/admin/marketing/retention'],
    ['Repeat Revenue ৳', split.returningRevenue, '/admin/marketing/retention'],
    ['Repeat Orders', split.returningOrders, '/admin/marketing/retention'],
  ];

  return (
    <div>
      <PageHead title="Marketing Dashboard" sub="Growth at a glance — read-only insights from live order data" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(([label, value, link]) => (
          <Link key={label} to={link}><Card><p className="text-xs text-gray-500 dark:text-ash">{label}</p><p className="text-2xl font-bold mt-1">{value ?? '…'}</p></Card></Link>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold text-sm mb-3">Revenue — last 14 days</h3>
          <Bars rows={(d?.series || []).map((r) => ({ label: r._id.slice(5), value: r.revenue }))} money />
          <Link to="/admin/marketing/sales" className="text-xs text-primary-700 hover:underline">Full sales analytics →</Link>
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-3">Quick actions</h3>
          <div className="grid gap-2 text-sm">
            <Link to="/admin/marketing/growth" className="p-3 rounded-lg border border-[#e5e2da] dark:border-[#2a3b30] hover:bg-black/5">🚀 Abandoned carts + best campaign hours</Link>
            <Link to="/admin/marketing/customers" className="p-3 rounded-lg border border-[#e5e2da] dark:border-[#2a3b30] hover:bg-black/5">👥 At-risk customers for re-engagement</Link>
            <Link to="/admin/marketing/coupons" className="p-3 rounded-lg border border-[#e5e2da] dark:border-[#2a3b30] hover:bg-black/5">🎟️ Which coupons actually pay back</Link>
            <Link to="/admin/marketing/quality" className="text-xs text-gray-500 hover:underline">Data quality & what's not tracked yet →</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

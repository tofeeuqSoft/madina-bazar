import { useEffect, useState } from 'react';
import marketingApi from '../../../services/marketing';
import { Card, PageHead, Empty, inputCls } from './widgets';

const SEGMENT_TIP = {
  Champions: 'Reward + early access — your best billboards',
  'Loyal Customers': 'Loyalty offers, keep them close',
  'New Customers': 'Onboard well — 2nd order is everything',
  'Potential Loyalists': 'Nudge with small offers',
  'At Risk': 'Win back NOW with personal outreach',
  'Cannot Lose Them': 'Big spenders slipping — call them',
  Hibernating: 'Reactivation campaign candidates',
  'Lost Customers': 'Last-resort winback or let go',
};

export default function Customers() {
  const [d, setD] = useState(null);
  const [seg, setSeg] = useState('');
  useEffect(() => { marketingApi.rfm().then(setD).catch(() => {}); }, []);
  const segs = d?.segments || {};
  const rows = (d?.customers || []).filter((c) => !seg || c.segment === seg);

  return (
    <div>
      <PageHead
        title="Customers & RFM"
        sub={`${d?.total ?? '…'} customers scored — export a segment to CSV for SMS campaigns`}
        right={<a className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-700 text-white" href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/admin/marketing/rfm/export${seg ? `?segment=${encodeURIComponent(seg)}` : ''}`}>Export CSV</a>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {Object.entries(segs).map(([k, v]) => (
          <button key={k} onClick={() => setSeg(seg === k ? '' : k)} className="text-left">
            <Card className={seg === k ? '!border-primary-600' : ''}>
              <p className="text-xs text-gray-500">{k}</p>
              <p className="text-2xl font-bold">{v}</p>
              <p className="text-[11px] text-gray-400 mt-1">{SEGMENT_TIP[k] || ''}</p>
            </Card>
          </button>
        ))}
      </div>
      <Card>
        <div className="flex gap-2 mb-3 items-center">
          <select className={inputCls} style={{ maxWidth: 240 }} value={seg} onChange={(e) => setSeg(e.target.value)}>
            <option value="">All segments</option>
            {Object.keys(segs).map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        {rows.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead><tr className="text-left text-gray-500"><th className="p-2">Customer</th><th className="p-2">Phone</th><th className="p-2">R/F/M</th><th className="p-2">Spent</th><th className="p-2">Segment</th></tr></thead>
              <tbody>
                {rows.slice(0, 100).map((c) => (
                  <tr key={c.customerId} className="border-t border-black/5">
                    <td className="p-2">{c.name}</td><td className="p-2 text-xs">{c.phone}</td>
                    <td className="p-2 text-xs">{c.r}/{c.f}/{c.m} • {c.frequency}× • {c.recencyDays}d ago</td>
                    <td className="p-2 font-medium">৳{c.monetary}</td><td className="p-2 text-xs">{c.segment}</td>
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

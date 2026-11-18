import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import marketingApi from '../../../services/marketing';
import { Card, PageHead, Empty, Bars } from './widgets';

export function Retention() {
  const [d, setD] = useState(null);
  useEffect(() => { marketingApi.retention().then(setD).catch(() => {}); }, []);
  return (
    <div>
      <PageHead title="Retention" sub={`Repeat purchase rate: ${d?.repeatRate ?? '…'}% — retention is cheaper than acquisition`} />
      <Card>
        {!(d?.cohorts || []).length ? <Empty /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th className="p-2">Cohort</th><th className="p-2">Buyers</th><th className="p-2">Month+1</th><th className="p-2">Month+2</th><th className="p-2">Month+3</th></tr></thead>
            <tbody>
              {d.cohorts.map((c) => (
                <tr key={c.cohort} className="border-t border-black/5">
                  <td className="p-2 font-medium">{c.cohort}</td><td className="p-2">{c.size}</td>
                  <td className="p-2">{c.m1}%</td><td className="p-2">{c.m2}%</td><td className="p-2">{c.m3}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

export function Growth() {
  const [d, setD] = useState(null);
  useEffect(() => { marketingApi.growth().then(setD).catch(() => {}); }, []);
  const cartValue = (d?.abandoned || []).reduce((s, c) => s + (c.value || 0), 0);
  return (
    <div>
      <PageHead title="Growth Levers" sub="Recoverable money + when to shout" />
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <Card><p className="text-xs text-gray-500">Abandoned carts (24h+)</p><p className="text-2xl font-bold">{d?.abandoned?.length ?? '…'}</p></Card>
        <Card><p className="text-xs text-gray-500">Recoverable value</p><p className="text-2xl font-bold">৳{cartValue}</p></Card>
        <Card><p className="text-xs text-gray-500">Repeat revenue share</p><p className="text-2xl font-bold">{d?.split ? `${Math.round((d.split.returningRevenue / Math.max(1, d.split.returningRevenue + d.split.newRevenue)) * 100)}%` : '…'}</p></Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold text-sm mb-2">🛒 Abandoned carts — call/SMS these customers</h3>
          {(d?.abandoned || []).length === 0 ? <Empty text="No abandoned carts" /> : (d.abandoned.slice(0, 20).map((c, i) => (
            <p key={i} className="text-xs py-1.5 border-t border-black/5 flex justify-between"><span>{c.customer} • {c.phone} • {c.items} items</span><b>৳{c.value}</b></p>
          )))}
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-3">📣 Best campaign hours</h3>
          <Bars rows={(d?.bestHours || []).map((r) => ({ label: `${r._id}:00`, value: r.orders }))} />
          <Link to="/admin/marketing/customers" className="text-xs text-primary-700 hover:underline">Export At-Risk segment for winback →</Link>
        </Card>
      </div>
    </div>
  );
}

export function Quality() {
  const [d, setD] = useState(null);
  useEffect(() => { marketingApi.quality().then(setD).catch(() => {}); }, []);
  const color = { OK: 'bg-green-100 text-green-700', WARNING: 'bg-amber-100 text-amber-800', ENFORCED: 'bg-blue-100 text-blue-700', DATA_UNAVAILABLE: 'bg-gray-200 text-gray-600' };
  return (
    <div>
      <PageHead title="Data Quality" sub={`${d?.totalOrders ?? '…'} orders scanned — bad data is quarantined, never silent`} />
      <Card>
        {(d?.checks || []).map((c, i) => (
          <div key={i} className="py-2.5 border-t border-black/5 text-sm first:border-0">
            <span className={`text-[11px] px-2 py-1 rounded-full font-medium mr-2 ${color[c.status]}`}>{c.status.replace(/_/g, ' ')}</span>
            <b>{c.check}</b><p className="text-xs text-gray-500 mt-0.5">{c.detail}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}

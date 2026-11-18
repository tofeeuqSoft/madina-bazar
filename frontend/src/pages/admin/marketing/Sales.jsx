import { useEffect, useState } from 'react';
import marketingApi from '../../../services/marketing';
import { Card, PageHead, Bars, inputCls, btnPrimary } from './widgets';

export default function Sales() {
  const [d, setD] = useState(null);
  const [grain, setGrain] = useState('day');
  const [range, setRange] = useState({ from: '', to: '' });
  const load = async () => {
    setD(await marketingApi.sales({ grain, from: range.from || undefined, to: range.to || undefined }).catch(() => null));
  };
  useEffect(() => { load(); }, [grain]);

  const o = d?.overview || {};
  return (
    <div>
      <PageHead title="Sales Analytics" sub={`Cancelled orders excluded • growth ${d?.growthPct ?? '…'}%`} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[['Revenue ৳', o.revenue], ['Orders', o.orders], ['AOV ৳', o.aov], ['Customers', o.customers]].map(([l, v]) => (
          <Card key={l}><p className="text-xs text-gray-500">{l}</p><p className="text-xl font-bold">{v ?? '…'}</p></Card>
        ))}
      </div>
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <select className={inputCls} value={grain} onChange={(e) => setGrain(e.target.value)}>
            <option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option>
          </select>
          <input className={inputCls} type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          <input className={inputCls} type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          <button onClick={load} className={btnPrimary}>Apply</button>
        </div>
      </Card>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card><h3 className="font-semibold text-sm mb-3">Revenue</h3><Bars rows={(d?.series || []).map((r) => ({ label: r._id, value: r.revenue }))} money /></Card>
        <Card>
          <h3 className="font-semibold text-sm mb-1">Best hours to run campaigns (last 30d)</h3>
          <p className="text-[11px] text-gray-500 mb-3">Post offers when your customers actually order</p>
          <Bars rows={(d?.bestHours || []).map((r) => ({ label: `${r._id}:00`, value: r.orders }))} />
        </Card>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import marketingApi from '../../../services/marketing';
import { Card, PageHead, Empty, Bars } from './widgets';

export function Geography() {
  const [rows, setRows] = useState([]);
  useEffect(() => { marketingApi.geo().then(setRows).catch(() => {}); }, []);
  return (
    <div>
      <PageHead title="Geography" sub="Where the money comes from — expand zones & riders where revenue proves demand" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card><h3 className="font-semibold text-sm mb-3">Revenue by area</h3><Bars rows={rows.slice(0, 15).map((r) => ({ label: `${r.city} ${r.area}`.slice(0, 20), value: r.revenue }))} money /></Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">Top areas</h3>
          {rows.length === 0 ? <Empty /> : rows.slice(0, 15).map((r, i) => (
            <p key={i} className="text-xs py-1.5 border-t border-black/5 flex justify-between"><span>{r.city} — {r.area || '—'} ({r.orders} orders, {r.customers} customers)</span><b>৳{r.revenue} • AOV ৳{r.aov}</b></p>
          ))}
        </Card>
      </div>
    </div>
  );
}

export function Coupons() {
  const [rows, setRows] = useState([]);
  useEffect(() => { marketingApi.coupons().then(setRows).catch(() => {}); }, []);
  return (
    <div>
      <PageHead title="Coupons & Campaigns" sub="Revenue per ৳1 discount — kill losers, scale winners" />
      <Card>
        {rows.length === 0 ? <Empty text="No coupon orders yet — run your first campaign" /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th className="p-2">Code</th><th className="p-2">Orders</th><th className="p-2">Revenue</th><th className="p-2">Discount given</th><th className="p-2">৳ revenue / ৳1 off</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.code} className="border-t border-black/5">
                  <td className="p-2 font-bold">{c.code} {!c.active && <span className="text-[10px] text-gray-400">(off)</span>}</td>
                  <td className="p-2">{c.orders}</td><td className="p-2">৳{c.revenue}</td>
                  <td className="p-2">৳{c.discountGiven}</td>
                  <td className="p-2 font-bold text-green-700">{c.revenuePerTakaDiscount}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import supportApi from '../../../services/support';
import { Card, PageHead, Empty, inputCls, btnPrimary } from './widgets';

export default function Customer360() {
  const [sp, setSp] = useSearchParams();
  const [id, setId] = useState(sp.get('id') || '');
  const [data, setData] = useState(null);

  const load = async (e) => {
    e?.preventDefault();
    if (!id) return;
    const d = await supportApi.customer360(id).catch(() => null);
    setData(d);
    setSp({ id });
  };

  const s = data?.stats;
  return (
    <div>
      <PageHead title="Customer 360°" sub="Full support context in one screen — orders, payments, chats, tickets, returns, refunds" />
      <Card className="mb-4">
        <form onSubmit={load} className="flex gap-2">
          <input className={inputCls} placeholder="Customer ID…" value={id} onChange={(e) => setId(e.target.value)} />
          <button className={btnPrimary}>Load</button>
        </form>
      </Card>
      {!data ? <Card><Empty text="Enter a customer ID to load 360° view" /></Card> : (
        <>
          <div className="grid md:grid-cols-4 gap-4 mb-4">
            {[['Orders', s.totalOrders], ['Purchase ৳', s.totalPurchase], ['Tickets', s.totalTickets], ['Open', s.openTickets]].map(([l, v]) => (
              <Card key={l}><p className="text-xs text-gray-500">{l}</p><p className="text-xl font-bold">{v}</p></Card>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card><h3 className="font-semibold text-sm mb-2">Profile</h3><p className="text-sm">{data.profile?.name} • {data.profile?.phone} • {data.profile?.email}</p><p className="text-xs text-gray-500 mt-1">Satisfaction: {s.satisfaction}★ • Returns: {s.returns} • Complaints: {s.complaints}</p></Card>
            <Card><h3 className="font-semibold text-sm mb-2">Recent tickets</h3>{(data.history.tickets || []).map((t) => <p key={t._id} className="text-xs py-1 border-t border-black/5">{t.ticketId} — {t.subject} ({t.status})</p>)}</Card>
            <Card><h3 className="font-semibold text-sm mb-2">Orders</h3>{(data.history.orders || []).map((o) => <p key={o._id} className="text-xs py-1 border-t border-black/5">{o.orderNumber} — {o.orderStatus} — ৳{o.totalAmount}</p>)}</Card>
            <Card><h3 className="font-semibold text-sm mb-2">Payments</h3>{(data.history.payments || []).map((p) => <p key={p._id} className="text-xs py-1 border-t border-black/5">৳{p.amount} — {p.status} — {p.method}</p>)}</Card>
          </div>
        </>
      )}
    </div>
  );
}

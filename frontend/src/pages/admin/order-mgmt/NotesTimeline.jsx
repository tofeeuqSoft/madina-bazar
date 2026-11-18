import { useState } from 'react';
import orderAdminApi from '../../../services/orderAdmin';
import { Card, PageHead, Empty, inputCls, btnPrimary } from './widgets';

export function OrderNotes() {
  const [id, setId] = useState('');
  const [notes, setNotes] = useState([]);
  const load = async (e) => {
    e?.preventDefault();
    if (!id) return;
    setNotes((await orderAdminApi.notes(id).catch(() => [])) || []);
  };
  return (
    <div>
      <PageHead title="Order Notes" sub="INTERNAL = staff only • CUSTOMER = visible to customer" />
      <Card className="mb-4"><form onSubmit={load} className="flex gap-2"><input className={inputCls} placeholder="Order _id…" value={id} onChange={(e) => setId(e.target.value)} /><button className={btnPrimary}>Load</button></form></Card>
      <Card>{notes.length === 0 ? <Empty /> : notes.map((n) => <p key={n._id} className="text-xs py-2 border-t border-black/5">[{n.visibility}] {n.content} — {n.createdBy?.name}</p>)}</Card>
    </div>
  );
}

export function OrderTimelinePage() {
  const [id, setId] = useState('');
  const [tl, setTl] = useState(null);
  const load = async (e) => {
    e?.preventDefault();
    if (!id) return;
    setTl(await orderAdminApi.timeline(id).catch(() => null));
  };
  return (
    <div>
      <PageHead title="Order Timeline" sub="Status history + immutable audit events with actor, IP, old/new values" />
      <Card className="mb-4"><form onSubmit={load} className="flex gap-2"><input className={inputCls} placeholder="Order _id…" value={id} onChange={(e) => setId(e.target.value)} /><button className={btnPrimary}>Load</button></form></Card>
      <Card>
        {!tl ? <Empty /> : (
          <div className="space-y-2 text-xs">
            {(tl.statusHistory || []).map((h, i) => <p key={i} className="border-l-2 border-primary-300 pl-3"><b>{h.status}</b> — {h.note} • {h.changedBy?.name} {h.timestamp ? new Date(h.timestamp).toLocaleString() : ''}</p>)}
            {(tl.audits || []).map((a) => <p key={a._id} className="border-l-2 border-amber-300 pl-3 text-gray-500">{a.action} — {a.actorRole} • {a.ip} • {new Date(a.createdAt).toLocaleString()}</p>)}
          </div>
        )}
      </Card>
    </div>
  );
}

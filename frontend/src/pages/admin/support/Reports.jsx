import { useEffect, useState } from 'react';
import supportApi from '../../../services/support';
import { Card, PageHead } from './widgets';

export default function Reports() {
  const [r, setR] = useState(null);
  useEffect(() => { supportApi.reports().then(setR).catch(() => {}); }, []);
  const t = r?.totals || {};
  return (
    <div>
      <PageHead title="Reports & Analytics" sub="Volume • resolution • agent performance • AI metrics reserved" />
      <div className="grid md:grid-cols-4 gap-4 mb-4">
        {[['Total', t.total], ['Open', t.open], ['Resolved', t.resolved], ['Closed', t.closed]].map(([l, v]) => (
          <Card key={l}><p className="text-xs text-gray-500">{l}</p><p className="text-xl font-bold">{v ?? '…'}</p></Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card><h3 className="font-semibold text-sm mb-2">Satisfaction by aspect</h3>{(r?.satisfaction || []).map((s) => <p key={s._id} className="text-xs py-1">{s._id}: {Number(s.avg).toFixed(2)}★ ({s.count})</p>) || <p className="text-xs">—</p>}</Card>
        <Card><h3 className="font-semibold text-sm mb-2">AI metrics (future)</h3><p className="text-xs">Conversations: {r?.ai?.conversations ?? 0} • Resolution: {r?.ai?.resolutionRate ?? 0}% • Escalation: {r?.ai?.escalationRate ?? 0}% • Handoff: {r?.ai?.handoffRate ?? 0}%</p></Card>
      </div>
    </div>
  );
}

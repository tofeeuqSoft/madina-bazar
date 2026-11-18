import { useEffect, useState } from 'react';
import supportApi from '../../../services/support';
import { Card, PageHead, Empty } from './widgets';

export default function Feedback() {
  const [list, setList] = useState([]);
  useEffect(() => { supportApi.feedback().then(setList).catch(() => {}); }, []);
  const avg = list.length ? (list.reduce((s, f) => s + f.rating, 0) / list.length).toFixed(2) : '—';
  return (
    <div>
      <PageHead title="Customer Feedback" sub={`Average rating: ${avg}★ • human vs AI tracked separately`} />
      <Card>{list.length === 0 ? <Empty /> : list.map((f) => (
        <div key={f._id} className="py-2 border-t border-black/5 text-sm">
          <p>{'⭐'.repeat(f.rating)} <span className="text-xs text-gray-500">• {f.ratedAspect} {f.aiRating ? '• AI' : '• Human'} • {f.customer?.name}</span></p>
          {f.comment && <p className="text-xs mt-1">{f.comment}</p>}
        </div>))}</Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
import supportApi from '../../../services/support';
import { Card, PageHead, Empty } from './widgets';

export default function Notifications() {
  const [list, setList] = useState([]);
  useEffect(() => { supportApi.notifications().then(setList).catch(() => {}); }, []);
  return (
    <div>
      <PageHead title="Notifications" sub="In-app today • Email/SMS/Push ready for future channels" />
      <Card>{list.length === 0 ? <Empty /> : list.map((n) => (
        <div key={n._id} className="py-2 border-t border-black/5 text-sm">
          <p className="font-medium">{n.title}</p>
          <p className="text-xs text-gray-500">{n.body} • {n.type} • {n.status}</p>
        </div>))}</Card>
    </div>
  );
}

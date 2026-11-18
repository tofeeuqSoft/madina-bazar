import { useEffect, useState } from 'react';
import supportApi from '../../../services/support';
import { Card, PageHead, StatusBadge, Empty } from './widgets';

export default function Conversations() {
  const [list, setList] = useState([]);
  useEffect(() => {
    supportApi.conversations({ limit: 50 }).then((r) => setList(r.data || [])).catch(() => {});
  }, []);
  return (
    <div>
      <PageHead title="All Conversations" sub="Ticket threads + live-chat rooms share one AI-ready message schema" />
      <Card>
        {list.length === 0 ? <Empty /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th className="p-2">ID</th><th className="p-2">Customer</th><th className="p-2">Status</th><th className="p-2">Intent</th><th className="p-2">Last active</th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30]">
                  <td className="p-2 font-medium">{c.conversationId}</td>
                  <td className="p-2">{c.customer?.name || '—'}</td>
                  <td className="p-2"><StatusBadge value={c.status} /></td>
                  <td className="p-2 text-xs">{c.intent || '—'}{c.escalated ? ' ⚠️' : ''}</td>
                  <td className="p-2 text-xs">{new Date(c.lastMessageAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

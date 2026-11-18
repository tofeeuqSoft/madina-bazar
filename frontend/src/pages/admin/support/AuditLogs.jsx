import { useEffect, useState } from 'react';
import supportApi from '../../../services/support';
import { Card, PageHead, Empty } from './widgets';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { supportApi.audit({}).then(setLogs).catch(() => {}); }, []);
  return (
    <div>
      <PageHead title="Audit Logs" sub="Every ticket/chat/refund/AI-tool action — actorType includes AI_AGENT" />
      <Card>
        {logs.length === 0 ? <Empty /> : (
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-500"><th className="p-2">Time</th><th className="p-2">Actor</th><th className="p-2">Action</th><th className="p-2">Ref</th><th className="p-2">Tool</th></tr></thead>
            <tbody>{logs.map((l) => <tr key={l._id} className="border-t border-black/5"><td className="p-2">{new Date(l.createdAt).toLocaleString()}</td><td className="p-2">{l.actorType}</td><td className="p-2">{l.action}</td><td className="p-2">{l.referenceId}</td><td className="p-2">{l.toolUsed || '—'}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

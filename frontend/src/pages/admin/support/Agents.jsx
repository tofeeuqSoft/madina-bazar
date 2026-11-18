import { useEffect, useState } from 'react';
import supportApi from '../../../services/support';
import { Card, PageHead, Empty } from './widgets';

export default function Agents() {
  const [agents, setAgents] = useState([]);
  useEffect(() => { supportApi.agents().then(setAgents).catch(() => {}); }, []);
  return (
    <div>
      <PageHead title="Support Agents" sub="Users with SUPPORT_* roles — manual + automatic assignment pool" />
      <Card>
        {agents.length === 0 ? <Empty text="No support agents yet — set user role to SUPPORT_AGENT / SUPPORT_MANAGER" /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Role</th><th className="p-2">Active</th></tr></thead>
            <tbody>{agents.map((a) => <tr key={a._id} className="border-t border-black/5"><td className="p-2">{a.name}</td><td className="p-2">{a.email}</td><td className="p-2">{a.role}</td><td className="p-2">{a.isActive ? '✅' : '❌'}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
import supportApi from '../../../services/support';
import { Card, PageHead, Empty } from './widgets';

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [cats, setCats] = useState([]);
  const load = async () => {
    setTeams((await supportApi.teams().catch(() => [])) || []);
    setCats((await supportApi.categories().catch(() => [])) || []);
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHead title="Support Teams & Categories" sub="Category → team auto-routing • round-robin / least-busy / skill-based" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold text-sm mb-2">Teams ({teams.length})</h3>
          {teams.length === 0 ? <Empty text="Run: node utils/seedSupport.js" /> : teams.map((t) => (
            <div key={t._id} className="py-2 border-t border-black/5 text-sm">
              <p className="font-medium">{t.name} <span className="text-[10px] text-gray-500">• {t.teamType} • {t.assignmentRule}</span></p>
              <p className="text-xs text-gray-500">Members: {(t.members || []).map((m) => m.name || m).join(', ') || '—'}</p>
            </div>
          ))}
          <p className="text-[11px] text-gray-500 mt-2">Tip: assign members by PATCH /api/support/teams/:id with member user IDs.</p>
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">Ticket Categories ({cats.length})</h3>
          {cats.length === 0 ? <Empty text="Run: node utils/seedSupport.js" /> : cats.map((c) => (
            <p key={c._id} className="text-xs py-1.5 border-t border-black/5">{c.name} <span className="text-gray-400">• /{c.slug}</span></p>
          ))}
        </Card>
      </div>
    </div>
  );
}

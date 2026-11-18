import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import supportApi from '../../../services/support';
import { Card, PageHead, StatusBadge, Empty, inputCls, btnPrimary, btnGhost } from './widgets';

export default function TicketDetails() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [agents, setAgents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [notes, setNotes] = useState([]);
  const [note, setNote] = useState('');
  const [canned, setCanned] = useState([]);

  const load = async () => {
    const t = await supportApi.ticket(id).catch(() => null);
    setTicket(t);
    const m = await supportApi.ticketMessages(id, { limit: 100 }).catch(() => ({ data: [] }));
    setMessages(m.data || []);
    const n = await supportApi.notes({ ticket: id }).catch(() => []);
    setNotes(n || []);
  };

  useEffect(() => {
    load();
    supportApi.agents().then(setAgents).catch(() => {});
    supportApi.teams().then(setTeams).catch(() => {});
    supportApi.canned().then(setCanned).catch(() => {});
  }, [id]);

  const send = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    await supportApi.replyTicket(id, { content: reply });
    setReply('');
    load();
  };

  const setStatus = async (status) => { await supportApi.setStatus(id, status); load(); };
  const assign = async (agent) => { await supportApi.assign(id, { agent }); load(); };
  const auto = async () => { await supportApi.autoAssign(id); load(); };
  const addNote = async (e) => {
    e.preventDefault();
    if (!note.trim() || !ticket) return;
    await supportApi.addNote({ customer: ticket.customer?._id || ticket.customer, ticket: id, content: note });
    setNote('');
    load();
  };
  const insertCanned = async (c) => {
    const r = await supportApi.useCanned(c._id, { customer_name: ticket?.customer?.name || '', ticket_id: ticket?.ticketId || '' });
    setReply(r.rendered || c.template);
  };

  if (!ticket) return <Empty text="Loading ticket…" />;

  return (
    <div>
      <PageHead
        title={`${ticket.ticketId} — ${ticket.subject}`}
        sub={`Customer: ${ticket.customer?.name || ''} • ${ticket.customer?.phone || ''}`}
        right={<Link to="/admin/support/tickets" className={btnGhost}>Back</Link>}
      />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex flex-wrap gap-2 items-center mb-4">
              <StatusBadge value={ticket.status} />
              <StatusBadge value={ticket.priority} />
              {ticket.intent && <span className="text-[11px] px-2 py-1 rounded-full bg-violet-100 text-violet-700">intent: {ticket.intent}</span>}
              {ticket.escalated && <span className="text-[11px] px-2 py-1 rounded-full bg-red-100 text-red-700">AI escalated</span>}
            </div>
            <p className="text-sm whitespace-pre-wrap">{ticket.description || '—'}</p>
            {ticket.relatedOrder && <p className="text-xs mt-3 text-gray-500">Order: {ticket.relatedOrder.orderNumber} • {ticket.relatedOrder.orderStatus} • ৳{ticket.relatedOrder.totalAmount}</p>}
            <div className="flex flex-wrap gap-2 mt-4">
              {['IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED', 'REOPENED'].map((s) => (
                <button key={s} onClick={() => setStatus(s)} className={btnGhost}>{s.replace(/_/g, ' ')}</button>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-sm mb-3">Conversation (chronological — HUMAN + future AI share this thread)</h3>
            <div className="space-y-3 max-h-[420px] overflow-y-auto mb-4">
              {messages.map((m) => (
                <div key={m._id} className={`p-3 rounded-lg text-sm ${m.senderType === 'CUSTOMER' ? 'bg-[#f7f5f0] dark:bg-white/5' : m.senderType === 'AI_AGENT' ? 'bg-violet-50 dark:bg-violet-900/20' : 'bg-primary-50 dark:bg-primary-900/20'}`}>
                  <div className="flex gap-2 items-center text-[11px] text-gray-500 mb-1">
                    <b>{m.senderType}</b><span>{new Date(m.createdAt).toLocaleString()}</span>
                    {m.intent && <span>• {m.intent} ({m.confidence ?? '—'})</span>}
                  </div>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}
              {messages.length === 0 && <Empty text="No messages yet" />}
            </div>
            {canned.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {canned.slice(0, 6).map((c) => (
                  <button key={c._id} onClick={() => insertCanned(c)} className="text-[11px] px-2 py-1 rounded-full border border-[#e5e2da] dark:border-[#2a3b30] hover:bg-black/5" title={c.template}>/{c.slug}</button>
                ))}
              </div>
            )}
            <form onSubmit={send} className="flex gap-2">
              <input className={inputCls} placeholder="Reply as support agent…" value={reply} onChange={(e) => setReply(e.target.value)} />
              <button className={btnPrimary}>Send</button>
            </form>
          </Card>

          <Card>
            <h3 className="font-semibold text-sm mb-2">Internal Notes (customer never sees • never auto-fed to AI)</h3>
            <div className="space-y-2 mb-3">
              {notes.map((n) => <p key={n._id} className="text-xs p-2 rounded bg-amber-50 dark:bg-amber-900/20">🔒 {n.content} <span className="text-gray-400">— {n.createdBy?.name}</span></p>)}
              {notes.length === 0 && <p className="text-xs text-gray-500">No internal notes.</p>}
            </div>
            <form onSubmit={addNote} className="flex gap-2">
              <input className={inputCls} placeholder="Add internal note…" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className={btnGhost}>Add</button>
            </form>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold text-sm mb-3">Assignment</h3>
            <p className="text-xs mb-1">Team: <b>{ticket.assignedTeam?.name || '—'}</b></p>
            <p className="text-xs mb-3">Agent: <b>{ticket.assignedAgent?.name || 'Unassigned'}</b></p>
            <select className={`${inputCls} mb-2`} onChange={(e) => e.target.value && assign(e.target.value)} defaultValue="">
              <option value="">Assign agent…</option>
              {agents.map((a) => <option key={a._id} value={a._id}>{a.name} ({a.role})</option>)}
            </select>
            <button onClick={auto} className={btnGhost}>Auto-assign (round-robin / least-busy / category)</button>
            <p className="text-[11px] text-gray-500 mt-2">Teams: {teams.map((t) => t.name).join(', ') || '—'}</p>
          </Card>
          <Card>
            <h3 className="font-semibold text-sm mb-2">Support Context</h3>
            <Link className="text-xs text-primary-700 hover:underline" to={`/admin/support/customers?id=${ticket.customer?._id || ''}`}>Open Customer 360° →</Link>
            {ticket.conversationSummary && <p className="text-xs mt-2">Summary: {ticket.conversationSummary}</p>}
            {ticket.handoffReason && <p className="text-xs mt-1 text-red-600">Handoff: {ticket.handoffReason}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import supportApi from '../../../services/support';
import { Card, PageHead, Empty, inputCls, btnPrimary } from './widgets';

export default function AIAssistant() {
  const [ctx, setCtx] = useState(null);
  const [ticketId, setTicketId] = useState('');
  const [handoff, setHandoff] = useState({ reason: '', summary: '', intent: 'GENERAL_QUERY' });

  const load = async () => {
    const d = await supportApi.aiContext(ticketId ? { ticket: ticketId } : {}).catch(() => null);
    setCtx(d);
  };
  useEffect(() => { load(); }, []);

  const doHandoff = async (e) => {
    e.preventDefault();
    await supportApi.aiHandoff({ ticketId: ticketId || undefined, ...handoff }).catch(() => {});
    alert('Handoff logged (AI → Human). Agent sees summary + intent + pending action.');
  };

  return (
    <div>
      <PageHead title="AI Assistant — Control Center" sub="Future integration staging area. AI never touches DB directly — only authorized tools." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold text-sm mb-2">AI Context Inspector</h3>
          <div className="flex gap-2 mb-3">
            <input className={inputCls} placeholder="Ticket _id (optional)" value={ticketId} onChange={(e) => setTicketId(e.target.value)} />
            <button onClick={load} className={btnPrimary}>Load</button>
          </div>
          {!ctx ? <Empty text="No context" /> : (
            <div className="text-xs space-y-2">
              <p><b>Tools allowed:</b> {ctx.tools?.join(', ')}</p>
              <p><b>Confidence threshold:</b> {ctx.confidenceThreshold}</p>
              {(ctx.messages || []).slice(-5).map((m, i) => <p key={i} className="p-2 rounded bg-black/5 dark:bg-white/5">[{m.senderType}] {m.content}</p>)}
            </div>
          )}
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">Simulate Human Handoff</h3>
          <form onSubmit={doHandoff} className="space-y-2">
            <select className={inputCls} value={handoff.intent} onChange={(e) => setHandoff({ ...handoff, intent: e.target.value })}>
              {['ORDER_STATUS','ORDER_CANCEL','PAYMENT_ISSUE','DELIVERY_STATUS','DELIVERY_AVAILABILITY','RETURN_REQUEST','REFUND_STATUS','PRODUCT_INFORMATION','PRODUCT_COMPLAINT','ACCOUNT_ISSUE','GENERAL_QUERY','HUMAN_AGENT_REQUEST'].map((i) => <option key={i}>{i}</option>)}
            </select>
            <input className={inputCls} placeholder="Reason (low confidence / complex issue)" value={handoff.reason} onChange={(e) => setHandoff({ ...handoff, reason: e.target.value })} />
            <textarea className={inputCls} rows={4} placeholder="Conversation summary for human agent…" value={handoff.summary} onChange={(e) => setHandoff({ ...handoff, summary: e.target.value })} />
            <button className={btnPrimary}>Log Handoff</button>
          </form>
          <div className="text-[11px] text-gray-500 mt-3 space-y-1">
            <p>• AI reads via <code>/ai/context</code> + <code>/ai/tools</code> only.</p>
            <p>• Every tool call is audited with actorType = AI_AGENT.</p>
            <p>• Refunds stay read-only unless REFUND_APPROVE granted.</p>
            <p>• RAG/vector DB can plug into <code>knowledgeSearch</code> later.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

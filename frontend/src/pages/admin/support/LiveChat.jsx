import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import supportApi from '../../../services/support';
import { Card, PageHead, StatusBadge, Empty, inputCls, btnPrimary } from './widgets';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

export default function LiveChat() {
  const [convos, setConvos] = useState([]);
  const [active, setActive] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(null);
  const socketRef = useRef(null);

  const loadConvos = async () => {
    const r = await supportApi.conversations({ limit: 30 }).catch(() => ({ data: [] }));
    setConvos(r.data || []);
    if (!active && r.data?.[0]) setActive(r.data[0]);
  };

  useEffect(() => { loadConvos(); }, []);

  useEffect(() => {
    // httpOnly cookie authenticates the handshake (XSS-safe, no token in JS)
    const s = io(SOCKET_URL, { withCredentials: true });
    socketRef.current = s;
    s.on('chat:message', (m) => {
      if (m.conversationId === active?.conversationId || String(m.conversation) === String(active?._id)) {
        setMsgs((p) => [...p, m]);
      }
    });
    s.on('chat:typing', (t) => {
      setTyping(t);
      setTimeout(() => setTyping(null), 2500);
    });
    return () => s.disconnect();
  }, [active?._id]);

  useEffect(() => {
    if (!active) return;
    socketRef.current?.emit('chat:join', active.conversationId);
    supportApi.chatMessages(active._id, { limit: 100 }).then((r) => setMsgs(r.data || [])).catch(() => {});
  }, [active?._id]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || !active) return;
    const msg = text;
    setText('');
    // REST persists (audited); socket broadcasts realtime
    const saved = await supportApi.replyChat(active._id, { content: msg }).catch(() => null);
    if (saved) setMsgs((p) => [...p, saved]);
    socketRef.current?.emit('chat:send', { conversationId: active.conversationId, content: msg });
  };

  const close = async () => {
    if (!active) return;
    await supportApi.patchConversation(active._id, { status: 'CLOSED' });
    loadConvos();
  };

  return (
    <div>
      <PageHead title="Live Chat" sub="Socket.IO rooms • typing • presence • read receipts • history preserved" />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="!p-2">
          {(convos || []).map((c) => (
            <button key={c._id} onClick={() => setActive(c)} className={`w-full text-left p-3 rounded-lg text-sm ${active?._id === c._id ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-black/5'}`}>
              <div className="flex justify-between items-center"><b>{c.conversationId}</b><StatusBadge value={c.status} /></div>
              <p className="text-xs text-gray-500">{c.customer?.name || c.customer} • {new Date(c.lastMessageAt).toLocaleString()}</p>
            </button>
          ))}
          {convos.length === 0 && <Empty text="No active chats" />}
        </Card>
        <Card className="lg:col-span-2">
          {!active ? <Empty text="Select a conversation" /> : (
            <>
              <div className="flex justify-between items-center mb-3">
                <b className="text-sm">{active.conversationId} — {active.customer?.name}</b>
                <button onClick={close} className="text-xs px-3 py-1.5 rounded-lg border">Close chat</button>
              </div>
              {typing && <p className="text-[11px] text-gray-500 mb-2">{typing.name} is typing…</p>}
              <div className="space-y-2 max-h-[440px] overflow-y-auto mb-3">
                {msgs.map((m) => (
                  <div key={m._id || Math.random()} className={`p-2.5 rounded-lg text-sm max-w-[85%] ${m.senderType === 'CUSTOMER' ? 'bg-[#f7f5f0] dark:bg-white/5' : 'bg-primary-700 text-white ml-auto'}`}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p className="text-[10px] opacity-60 mt-1">{m.senderType} • {m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : ''}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={send} className="flex gap-2">
                <input className={inputCls} placeholder="Type a reply… 🙂" value={text}
                  onChange={(e) => { setText(e.target.value); socketRef.current?.emit('chat:typing', { conversationId: active.conversationId, typing: true }); }} />
                <button className={btnPrimary}>Send</button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

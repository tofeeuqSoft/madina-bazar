import { useEffect, useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import supportApi from '../../services/support';
import useAuthStore from '../../store/authStore';

// Floating storefront chat — customers talk here; agents reply from admin.
// Same conversation infrastructure (senderType CUSTOMER/HUMAN_AGENT/AI_AGENT).
export default function SupportWidget() {
  const { isAuthenticated } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [convo, setConvo] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');

  const ensure = async () => {
    if (convo) return convo;
    const list = await supportApi.conversations({ limit: 1 }).catch(() => ({ data: [] }));
    let c = list.data?.[0];
    if (!c) c = await supportApi.createConversation({}).catch(() => null);
    setConvo(c);
    return c;
  };

  const load = async (c) => {
    if (!c) return;
    const m = await supportApi.chatMessages(c._id, { limit: 50 }).catch(() => ({ data: [] }));
    setMsgs(m.data || []);
  };

  useEffect(() => {
    if (open && isAuthenticated) ensure().then(load);
  }, [open ]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const c = convo || (await ensure());
    if (!c) return;
    await supportApi.replyChat(c._id, { content: text });
    setText('');
    load(c);
  };

  if (!isAuthenticated) return null;

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 md:bottom-6 right-4 z-40 w-14 h-14 rounded-full bg-primary-700 text-white shadow-lg flex items-center justify-center hover:bg-primary-800"
        aria-label="Customer support chat"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
      {open && (
        <div className="fixed bottom-36 md:bottom-24 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm bg-white dark:bg-[#12241a] rounded-2xl shadow-2xl border border-[#e5e2da] dark:border-[#2a3b30] overflow-hidden">
          <div className="bg-[#0b3d2a] text-white p-3">
            <p className="font-semibold text-sm">Madina Bazar Support</p>
            <p className="text-[11px] opacity-70">Typically replies within a few hours</p>
          </div>
          <div className="h-72 overflow-y-auto p-3 space-y-2">
            {msgs.length === 0 && <p className="text-xs text-gray-500 text-center py-8">আসসালামু আলাইকুম! How can we help? 👋</p>}
            {msgs.map((m) => (
              <div key={m._id} className={`p-2 rounded-lg text-sm max-w-[85%] ${m.senderType === 'CUSTOMER' ? 'bg-primary-700 text-white ml-auto' : 'bg-black/5 dark:bg-white/10'}`}>
                {m.content}
              </div>
            ))}
          </div>
          <form onSubmit={send} className="flex gap-2 p-3 border-t border-[#e5e2da] dark:border-[#2a3b30]">
            <input
              className="flex-1 border border-[#e5e2da] dark:border-[#2a3b30] rounded-lg px-3 py-2 text-sm bg-transparent outline-none"
              placeholder="Type your message…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="p-2 rounded-lg bg-primary-700 text-white" aria-label="Send">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

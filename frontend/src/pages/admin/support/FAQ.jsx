import { useEffect, useState } from 'react';
import supportApi from '../../../services/support';
import { Card, PageHead, Empty, inputCls, btnPrimary } from './widgets';

const CATS = ['ORDERS','PAYMENTS','DELIVERY','RETURNS','REFUNDS','PRODUCTS','ACCOUNT','GROCERY','NATIONWIDE_DELIVERY'];

export default function FAQ() {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ title: '', category: 'ORDERS', content: '', tags: '' });

  const load = async () => {
    const d = await supportApi.faq(search ? { search } : {}).catch(() => []);
    setList(d || []);
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    await supportApi.createFaq({ ...form, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean) });
    setForm({ title: '', category: 'ORDERS', content: '', tags: '' });
    load();
  };

  return (
    <div>
      <PageHead title="FAQ / Knowledge Base" sub="Structured for future RAG — title, content, category, tags, status, version" />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex gap-2 mb-3">
            <input className={inputCls} placeholder="Search articles…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
            <button onClick={load} className={btnPrimary}>Search</button>
          </div>
          {list.length === 0 ? <Empty /> : list.map((a) => (
            <div key={a._id} className="py-3 border-t border-[#e5e2da]/60 dark:border-[#2a3b30]">
              <p className="font-medium text-sm">{a.title} <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 ml-1">v{a.version} • {a.category}</span></p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.content}</p>
            </div>
          ))}
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">New Article</h3>
          <form onSubmit={create} className="space-y-2">
            <input className={inputCls} required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            <textarea className={inputCls} rows={5} required placeholder="Content (markdown)" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            <input className={inputCls} placeholder="tags, comma, separated" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            <button className={btnPrimary}>Publish</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import api from '../services/api';

export default function Faq() {
  const [articles, setArticles] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);

  const load = async (q) => {
    const res = await api.get('/support/faq', { params: q ? { search: q } : {} }).catch(() => ({ data: { data: [] } }));
    setArticles(res.data?.data || res.data || []);
  };
  useEffect(() => { load(''); }, []);
  useEffect(() => {
    const t = setTimeout(() => load(search), 400);
    return () => clearTimeout(t);
  }, [search ]);

  return (
    <div className="container-app py-10 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Help & FAQ</h1>
      <p className="text-sm text-gray-500 mb-6">সাধারণ প্রশ্নের উত্তর</p>
      <input className="input mb-6" placeholder="Search help articles…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="space-y-3">
        {articles.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No articles found.</p>}
        {articles.map((a) => (
          <div key={a._id} className="bg-white dark:bg-[#12241a] rounded-xl border border-[#e5e2da] dark:border-[#2a3b30] overflow-hidden">
            <button onClick={() => setOpen(open === a._id ? null : a._id)} className="w-full text-left p-4 font-medium text-sm flex justify-between gap-2">
              <span>{a.title}</span>
              <span className="text-gray-400">{open === a._id ? '−' : '+'}</span>
            </button>
            {open === a._id && <p className="px-4 pb-4 text-sm text-gray-600 dark:text-ash whitespace-pre-wrap">{a.content}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

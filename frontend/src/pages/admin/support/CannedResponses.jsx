import { useEffect, useState } from 'react';
import supportApi from '../../../services/support';
import { Card, PageHead, Empty, inputCls, btnPrimary } from './widgets';

export default function CannedResponses() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: '', slug: '', category: 'GENERAL', template: '' });
  const load = async () => setList((await supportApi.canned().catch(() => [])) || []);
  useEffect(() => { load(); }, []);
  const create = async (e) => {
    e.preventDefault();
    await supportApi.createCanned(form);
    setForm({ name: '', slug: '', category: 'GENERAL', template: '' });
    load();
  };
  return (
    <div>
      <PageHead title="Canned Responses" sub="/refund /return /delivery — approved templates reusable by future AI" />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          {list.length === 0 ? <Empty /> : list.map((c) => (
            <div key={c._id} className="py-3 border-t border-[#e5e2da]/60 dark:border-[#2a3b30]">
              <p className="text-sm font-medium">/{c.slug} <span className="text-[10px] text-gray-500">• {c.category} • used {c.usageCount}× {c.isApprovedForAI ? '• AI-approved' : ''}</span></p>
              <p className="text-xs mt-1">{c.template}</p>
            </div>
          ))}
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">New Response</h3>
          <form onSubmit={create} className="space-y-2">
            <input className={inputCls} required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={inputCls} placeholder="slug (auto)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {['REFUND','RETURN','DELIVERY','PAYMENT','CANCEL','ORDER_STATUS','GENERAL'].map((c) => <option key={c}>{c}</option>)}
            </select>
            <textarea className={inputCls} rows={4} required placeholder="Template — use {customer_name} {order_id}" value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })} />
            <button className={btnPrimary}>Save</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

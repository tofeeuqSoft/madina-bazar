import { useState } from 'react';
import toast from 'react-hot-toast';
import orderAdminApi from '../../../services/orderAdmin';
import { Card, PageHead, inputCls, btnPrimary } from './widgets';

export default function Communication() {
  const [form, setForm] = useState({ orderId: '', channel: 'IN_APP', message: '' });
  const send = async (e) => {
    e.preventDefault();
    try {
      await orderAdminApi.communicate(form.orderId, { channel: form.channel, message: form.message });
      toast.success('Logged + sent');
      setForm({ orderId: '', channel: 'IN_APP', message: '' });
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
  };
  return (
    <div>
      <PageHead title="Customer Communication" sub="Every message logged (sender, channel, status) • support chat NOT duplicated" />
      <Card>
        <form onSubmit={send} className="space-y-2 max-w-xl">
          <input className={inputCls} required placeholder="Order _id" value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value })} />
          <select className={inputCls} value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>{['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'].map((c) => <option key={c}>{c}</option>)}</select>
          <textarea className={inputCls} rows={4} required placeholder="Message…" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <button className={btnPrimary}>Send & Log</button>
        </form>
      </Card>
    </div>
  );
}

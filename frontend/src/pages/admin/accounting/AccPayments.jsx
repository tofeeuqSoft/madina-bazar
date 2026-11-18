import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { tk, downloadCSV } from '../../../utils/accFormat';

const STATUS_COLOR = {
  PENDING: 'bg-gold-400/15 text-gold-700 dark:text-gold-300',
  PAID: 'bg-success/15 text-success',
  FAILED: 'bg-danger/10 text-danger',
  CANCELLED: 'bg-black/5 text-smoke dark:bg-white/10 dark:text-ash',
  REFUNDED: 'bg-black/5 text-smoke dark:bg-white/10 dark:text-ash',
  PARTIALLY_REFUNDED: 'bg-gold-400/15 text-gold-700 dark:text-gold-300',
};

export default function AccPayments() {
  const [list, setList] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fStatus, setFStatus] = useState('');
  const [fMethod, setFMethod] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ orderId: '', amount: '', paymentMethod: 'COD', transactionId: '', note: '' });

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/accounting/payments', {
        params: { page: p, limit: 20, ...(fStatus ? { status: fStatus } : {}), ...(fMethod ? { method: fMethod } : {}) },
      });
      setList(data.data || []);
      setPage(data.page || p);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, [fStatus, fMethod]);

  const submitManual = async (e) => {
    e.preventDefault();
    try {
      await api.post('/accounting/payments', {
        orderId: form.orderId,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        transactionId: form.transactionId,
        note: form.note,
      });
      toast.success('Payment recorded (PENDING — verify to post)');
      setForm({ orderId: '', amount: '', paymentMethod: 'COD', transactionId: '', note: '' });
      setShowForm(false);
      load(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const act = async (id, action) => {
    const ok = action === 'verify'
      ? confirm('Verify this payment? Journals will post.')
      : confirm(`Mark payment as ${action === 'fail' ? 'FAILED' : 'CANCELLED'}?`);
    if (!ok) return;
    try {
      await api.patch(`/accounting/payments/${id}/${action}`);
      toast.success('Done');
      load(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-sm text-gray-500 dark:text-ash">Centralized — verify posts journals + order paid</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary text-sm">+ Record Payment</button>
      </div>

      {showForm && (
        <form onSubmit={submitManual} className="card p-5 mb-4 grid sm:grid-cols-2 gap-3 max-w-2xl">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Order ID *</label>
            <input className="input" value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value })} placeholder="Order _id" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Amount (৳) *</label>
            <input type="number" min="1" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Method</label>
            <select className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
              {['COD', 'BKASH', 'NAGAD', 'SSLCOMMERZ', 'CARD', 'BANK', 'CASH', 'OTHER'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Transaction ID</label>
            <input className="input" value={form.transactionId} onChange={(e) => setForm({ ...form, transactionId: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Note</label>
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary text-sm">Save as PENDING</button>
          </div>
        </form>
      )}

      <div className="flex gap-2 mb-4">
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="input w-auto text-sm">
          <option value="">All Status</option>
          {['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={fMethod} onChange={(e) => setFMethod(e.target.value)} className="input w-auto text-sm">
          <option value="">All Methods</option>
          {['COD', 'BKASH', 'NAGAD', 'SSLCOMMERZ', 'CARD', 'BANK', 'CASH'].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <button
          onClick={() => downloadCSV('payments', ['ID', 'Order', 'Customer', 'Amount', 'Fee', 'Net', 'Method', 'Txn', 'Status', 'Date'], list.map((p) => [p.paymentId, p.order?.orderNumber, p.customer?.name, p.amount, p.gatewayFee, p.netReceived, p.paymentMethod, p.transactionId, p.status, new Date(p.createdAt).toLocaleString()]))}
          className="btn-outline text-xs"
        >
          CSV
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f5f0] dark:bg-white/5">
            <tr>
              {['Payment', 'Order', 'Amount', 'Fee/Net', 'Method', 'Status', 'Date', 'Actions'].map((h) => (
                <th key={h} className="text-left p-3 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500">No payments</td></tr>
            ) : (
              list.map((p) => (
                <tr key={p._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30]">
                  <td className="p-3 whitespace-nowrap">
                    <div className="font-medium">{p.paymentId}</div>
                    <div className="text-[11px] text-gray-500">{p.transactionId || '—'}</div>
                  </td>
                  <td className="p-3">{p.order?.orderNumber || '—'}</td>
                  <td className="p-3 font-semibold">৳{p.amount}</td>
                  <td className="p-3 text-xs text-gray-500">fee ৳{p.gatewayFee}<br />net ৳{p.netReceived}</td>
                  <td className="p-3">{p.paymentMethod}</td>
                  <td className="p-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLOR[p.status] || ''}`}>{p.status}</span>
                  </td>
                  <td className="p-3 text-xs text-gray-500 whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="p-3 whitespace-nowrap">
                    {p.status === 'PENDING' && (
                      <>
                        <button onClick={() => act(p._id, 'verify')} className="text-xs text-success font-medium hover:underline mr-2">Verify</button>
                        <button onClick={() => act(p._id, 'fail')} className="text-xs text-red-500 hover:underline">Fail</button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm">
        <p className="text-gray-500">Total {total}</p>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => load(page - 1)} className="btn-outline text-xs">← Prev</button>
          <span className="px-2 py-1">Page {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => load(page + 1)} className="btn-outline text-xs">Next →</button>
        </div>
      </div>
    </div>
  );
}

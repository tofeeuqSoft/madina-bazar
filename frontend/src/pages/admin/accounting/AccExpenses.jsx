import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import DateRange, { rangeParams } from '../../../components/accounting/DateRange';
import { tk, downloadCSV } from '../../../utils/accFormat';

export default function AccExpenses() {
  const [range, setRange] = useState({ preset: 'month', from: '', to: '' });
  const [list, setList] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fCat, setFCat] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [cats, setCats] = useState([]);
  const [form, setForm] = useState({ title: '', category: 'Other Expense', amount: '', paymentMethod: 'Cash', note: '' });

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/expenses', {
        params: { ...rangeParams(range), page: p, limit: 20, ...(fCat ? { category: fCat } : {}) },
      });
      setList(data.data || []);
      setPage(data.page || p);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const loadCats = async () => {
    try {
      const { data } = await api.get('/accounting/settings');
      setCats(data.data?.settings?.expenseCategories || []);
    } catch (_) {}
  };

  useEffect(() => {
    loadCats();
  }, []);
  useEffect(() => {
    load(1);
  }, [range.preset, range.from, range.to, fCat]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/expenses', { ...form, amount: Number(form.amount) });
      toast.success('Expense recorded + journal posted');
      setForm({ title: '', category: 'Other Expense', amount: '', paymentMethod: 'Cash', note: '' });
      setShowForm(false);
      load(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const voidIt = async (id) => {
    const reason = prompt('Void reason:') || '';
    if (reason === null) return;
    try {
      await api.patch(`/expenses/${id}/void`, { reason });
      toast.success('Voided with reversal');
      load(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const sum = list.filter((x) => x.status !== 'VOIDED').reduce((s, x) => s + (x.amount || 0), 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-gray-500 dark:text-ash">No delete — void with reversal · Page total {tk(sum)}</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary text-sm">+ Add Expense</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card p-5 mb-4 grid sm:grid-cols-2 gap-3 max-w-2xl">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {(cats.length ? cats : ['Other Expense']).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Amount (৳) *</label>
            <input type="number" min="1" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Paid From</label>
            <select className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
              {['Cash', 'Bank', 'BKASH', 'NAGAD', 'SSLCOMMERZ', 'Other'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Note</label>
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary text-sm">Save Expense</button>
          </div>
        </form>
      )}

      <div className="flex gap-2 mb-4">
        <DateRange value={range} onChange={setRange} />
        <select value={fCat} onChange={(e) => setFCat(e.target.value)} className="input w-auto text-sm">
          <option value="">All Categories</option>
          {(cats.length ? cats : []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => downloadCSV('expenses', ['Title', 'Category', 'Amount', 'Method', 'Status', 'Date'], list.map((x) => [x.title, x.category, x.amount, x.paymentMethod, x.status || 'ACTIVE', new Date(x.expenseDate).toLocaleDateString()]))}
          className="btn-outline text-xs"
        >
          CSV
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f5f0] dark:bg-white/5">
            <tr>
              {['Title', 'Category', 'Amount', 'From', 'Status', 'Date', 'Actions'].map((h) => (
                <th key={h} className="text-left p-3 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">No expenses</td></tr>
            ) : (
              list.map((x) => (
                <tr key={x._id} className={`border-t border-[#e5e2da]/60 dark:border-[#2a3b30] ${x.status === 'VOIDED' ? 'opacity-50' : ''}`}>
                  <td className="p-3">{x.title}</td>
                  <td className="p-3">{x.category}</td>
                  <td className="p-3 font-semibold">৳{x.amount}</td>
                  <td className="p-3">{x.paymentMethod}</td>
                  <td className="p-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${x.status === 'VOIDED' ? 'bg-black/5 text-smoke dark:bg-white/10 dark:text-ash' : 'bg-success/15 text-success'}`}>
                      {x.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-gray-500 whitespace-nowrap">{new Date(x.expenseDate).toLocaleDateString()}</td>
                  <td className="p-3">
                    {x.status !== 'VOIDED' && (
                      <button onClick={() => voidIt(x._id)} className="text-xs text-red-500 hover:underline">Void</button>
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

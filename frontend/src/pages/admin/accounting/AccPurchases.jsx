import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { tk, downloadCSV } from '../../../utils/accFormat';

export default function AccPurchases() {
  const [tab, setTab] = useState('list');
  const [list, setList] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ supplier: '', invoiceNo: '', items: [{ product: '', name: '', quantity: 1, costPrice: '' }], paidAmount: '', paymentMethod: 'Cash' });
  const [paying, setPaying] = useState(null);
  const [payAmt, setPayAmt] = useState('');
  // supplier detail
  const [selSupplier, setSelSupplier] = useState('');
  const [supData, setSupData] = useState(null);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/purchases', { params: { page: p, limit: 20 } });
      setList(data.data || []);
      setPage(data.page || p);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  const loadRefs = async () => {
    try {
      const [s, p] = await Promise.all([
        api.get('/suppliers', { params: { limit: 200 } }),
        api.get('/products', { params: { limit: 200, isActive: 'all', scope: 'all' } }),
      ]);
      setSuppliers(s.data?.data || s.data || []);
      setProducts(p.data?.data || []);
    } catch (_) {}
  };

  useEffect(() => {
    load(1);
    loadRefs();
  }, []);

  useEffect(() => {
    if (tab === 'suppliers' && selSupplier) loadSupplier(selSupplier);
  }, [tab]);

  const loadSupplier = async (id) => {
    try {
      const { data } = await api.get(`/accounting/suppliers/${id}`);
      setSupData(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const setItem = (i, patch) => {
    setForm((f) => {
      const items = [...f.items];
      items[i] = { ...items[i], ...patch };
      if (patch.product) {
        const p = products.find((x) => x._id === patch.product);
        if (p) items[i] = { ...items[i], name: p.name, costPrice: p.costPrice || p.regularPrice || '' };
      }
      return { ...f, items };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/purchases', {
        supplier: form.supplier,
        invoiceNo: form.invoiceNo || undefined,
        items: form.items.filter((i) => i.name && i.quantity > 0 && i.costPrice !== '').map((i) => ({
          product: i.product || undefined,
          name: i.name,
          quantity: Number(i.quantity),
          costPrice: Number(i.costPrice),
        })),
        paidAmount: Number(form.paidAmount) || 0,
        paymentMethod: form.paymentMethod,
      });
      toast.success('Purchase received + journals posted');
      setShowForm(false);
      setForm({ supplier: '', invoiceNo: '', items: [{ product: '', name: '', quantity: 1, costPrice: '' }], paidAmount: '', paymentMethod: 'Cash' });
      load(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const payDue = async (purchase) => {
    const amt = Number(payAmt);
    if (!amt || amt <= 0) {
      toast.error('Enter amount');
      return;
    }
    try {
      await api.patch(`/purchases/${purchase._id}/payment`, {
        paidAmount: (purchase.paidAmount || 0) + amt,
        paymentMethod: purchase.paymentMethod,
      });
      toast.success('Supplier payment recorded');
      setPaying(null);
      setPayAmt('');
      load(page);
      if (selSupplier) loadSupplier(selSupplier);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const billTotal = form.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.costPrice) || 0), 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Purchases & Suppliers</h1>
          <p className="text-sm text-gray-500 dark:text-ash">Receive posts inventory + payable journals</p>
        </div>
        <div className="flex gap-2">
          {['list', 'suppliers'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-xs border ${tab === t ? 'bg-gray-900 text-white dark:bg-gold-400 dark:text-[#0a0f0c] border-transparent font-medium' : 'bg-white dark:bg-[#12241a] border-[#e5e2da] dark:border-[#2a3b30]'}`}
            >
              {t === 'list' ? 'Purchases' : 'Suppliers'}
            </button>
          ))}
          {tab === 'list' && (
            <button onClick={() => setShowForm((v) => !v)} className="btn-primary text-sm">+ New Purchase</button>
          )}
        </div>
      </div>

      {tab === 'list' && showForm && (
        <form onSubmit={submit} className="card p-5 mb-4 space-y-3 max-w-3xl">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Supplier *</label>
              <select className="input" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} required>
                <option value="">Select supplier</option>
                {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}{s.company ? ` (${s.company})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Invoice No</label>
              <input className="input" value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} placeholder="Auto if empty" />
            </div>
          </div>
          {form.items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <select className="input col-span-5" value={it.product} onChange={(e) => setItem(i, { product: e.target.value })}>
                <option value="">— product (optional) —</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <input className="input col-span-3" placeholder="Item name *" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
              <input type="number" min="1" className="input col-span-2" placeholder="Qty" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
              <input type="number" min="0" className="input col-span-2" placeholder="Unit cost" value={it.costPrice} onChange={(e) => setItem(i, { costPrice: e.target.value })} />
            </div>
          ))}
          <button type="button" onClick={() => setForm((f) => ({ ...f, items: [...f.items, { product: '', name: '', quantity: 1, costPrice: '' }] }))} className="btn-outline text-xs">
            + Add Row
          </button>
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Paid Now (৳)</label>
              <input type="number" min="0" className="input" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Method</label>
              <select className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                {['Cash', 'Bank', 'BKASH', 'NAGAD', 'SSLCOMMERZ', 'Other'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="text-sm font-semibold">Bill total: ৳{billTotal.toFixed(0)}</div>
          </div>
          <button type="submit" className="btn-primary text-sm">Receive Purchase</button>
        </form>
      )}

      {tab === 'list' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f5f0] dark:bg-white/5">
              <tr>
                {['Invoice', 'Supplier', 'Total', 'Paid', 'Due', 'Status', 'Date', 'Pay'].map((h) => (
                  <th key={h} className="text-left p-3 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">No purchases</td></tr>
              ) : (
                list.map((p) => (
                  <tr key={p._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30]">
                    <td className="p-3">{p.invoiceNo || p._id.slice(-6)}</td>
                    <td className="p-3">{p.supplier?.name || '—'}</td>
                    <td className="p-3 font-semibold">৳{p.totalCost}</td>
                    <td className="p-3 text-success">৳{p.paidAmount}</td>
                    <td className="p-3 text-danger">৳{p.dueAmount}</td>
                    <td className="p-3 text-xs">{p.paymentStatus}</td>
                    <td className="p-3 text-xs text-gray-500 whitespace-nowrap">{new Date(p.purchaseDate).toLocaleDateString()}</td>
                    <td className="p-3">
                      {paying === p._id ? (
                        <div className="flex gap-1">
                          <input type="number" min="1" className="input w-24 py-1 text-xs" placeholder="৳" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} />
                          <button onClick={() => payDue(p)} className="btn-primary text-xs py-1">Pay</button>
                          <button onClick={() => { setPaying(null); setPayAmt(''); }} className="text-xs text-gray-500">✕</button>
                        </div>
                      ) : (
                        p.dueAmount > 0 && (
                          <button onClick={() => { setPaying(p._id); setPayAmt(p.dueAmount); }} className="text-xs text-primary-600 dark:text-gold-300 hover:underline whitespace-nowrap">
                            Pay Due
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'suppliers' && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="card p-4 h-fit">
            <h3 className="font-semibold mb-2 text-sm">Select Supplier</h3>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {suppliers.map((s) => (
                <button
                  key={s._id}
                  type="button"
                  onClick={() => { setSelSupplier(s._id); loadSupplier(s._id); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selSupplier === s._id ? 'bg-primary-100 dark:bg-primary-800 font-medium' : 'hover:bg-primary-50 dark:hover:bg-primary-900/40'}`}
                >
                  {s.name}
                  <span className="block text-[11px] text-gray-500">{s.company || s.phone || ''}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2">
            {!supData ? (
              <p className="text-sm text-gray-500 card p-8 text-center">Select a supplier to see account</p>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    ['Total Purchase', tk(supData.summary?.totalPurchase)],
                    ['Total Paid', tk(supData.summary?.totalPaid)],
                    ['Returns', tk(supData.summary?.purchaseReturn)],
                    ['Payable', tk(supData.summary?.payable)],
                  ].map(([l, v]) => (
                    <div key={l} className="card p-3">
                      <p className="text-xs text-gray-500 dark:text-ash">{l}</p>
                      <p className="font-bold mt-0.5">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="card p-4">
                  <h3 className="font-semibold mb-2 text-sm">Payment History (purchases)</h3>
                  <div className="space-y-2 text-sm">
                    {(supData.purchases || []).map((p) => (
                      <div key={p._id} className="flex justify-between border-b border-[#e5e2da] dark:border-[#2a3b30] pb-2">
                        <span>{p.invoiceNo || p._id.slice(-6)} · {new Date(p.purchaseDate).toLocaleDateString()}</span>
                        <span>Total ৳{p.totalCost} · Paid ৳{p.paidAmount} · <b className="text-danger">Due ৳{p.dueAmount}</b></span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { tk, downloadCSV } from '../../../utils/accFormat';

export default function AccCustomers() {
  const [list, setList] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/accounting/customers', { params: { page: p, limit: 20, search: search || undefined } });
      setList(data.data || []);
      setPage(data.page || p);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => load(1), 400);
    return () => clearTimeout(t);
  }, [search]);

  const openDetail = async (id) => {
    if (detailId === id) {
      setDetailId(null);
      setDetail(null);
      return;
    }
    try {
      const { data } = await api.get(`/accounting/customers/${id}`);
      setDetail(data.data);
      setDetailId(id);
    } catch {
      toast.error('Failed to load account');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Customer Accounts</h1>
          <p className="text-sm text-gray-500 dark:text-ash">Orders, paid, refund, due & receivable</p>
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name/phone..." className="input w-48 text-sm" />
          <button
            onClick={() => downloadCSV('customers', ['Name', 'Phone', 'Orders', 'Purchase', 'Paid', 'Refund', 'Due'], list.map((c) => [c.name, c.phone, c.orders, c.purchase, c.paid, c.refund, c.due]))}
            className="btn-outline text-xs"
          >
            CSV
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f5f0] dark:bg-white/5">
            <tr>
              {['Customer', 'Orders', 'Purchase', 'Paid', 'Refund', 'Due', ''].map((h) => (
                <th key={h} className="text-left p-3 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">No customers</td></tr>
            ) : (
              list.map((c) => (
                <>
                  <tr key={c._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30]">
                    <td className="p-3">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-[11px] text-gray-500">{c.phone}</div>
                    </td>
                    <td className="p-3">{c.orders}</td>
                    <td className="p-3">৳{c.purchase}</td>
                    <td className="p-3 text-success">৳{c.paid}</td>
                    <td className="p-3">৳{c.refund}</td>
                    <td className="p-3 font-semibold text-danger">৳{c.due}</td>
                    <td className="p-3">
                      <button onClick={() => openDetail(c._id)} className="text-xs text-primary-600 dark:text-gold-300 hover:underline">
                        {detailId === c._id ? 'Hide' : 'Ledger'}
                      </button>
                    </td>
                  </tr>
                  {detailId === c._id && detail && (
                    <tr key={`${c._id}-d`} className="bg-[#f7f5f0]/60 dark:bg-white/[0.02]">
                      <td colSpan={7} className="p-3">
                        <div className="grid sm:grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="font-semibold mb-1">Recent Orders</p>
                            {(detail.orders || []).slice(0, 5).map((o) => (
                              <p key={o._id} className="text-gray-600 dark:text-gray-300">
                                #{o.orderNumber} · ৳{o.totalAmount} (paid ৳{o.paidAmount || 0}) · {o.orderStatus}
                              </p>
                            ))}
                          </div>
                          <div>
                            <p className="font-semibold mb-1">Payments</p>
                            {(detail.payments || []).slice(0, 5).map((p) => (
                              <p key={p._id} className="text-gray-600 dark:text-gray-300">
                                {p.paymentId} · ৳{p.amount} · {p.paymentMethod} · {p.status}
                              </p>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
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

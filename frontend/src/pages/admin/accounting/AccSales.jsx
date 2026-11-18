import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import DateRange, { rangeParams } from '../../../components/accounting/DateRange';
import { tk, downloadCSV } from '../../../utils/accFormat';

const STATUS_COLOR = {
  PAID: 'bg-success/15 text-success',
  UNPAID: 'bg-danger/10 text-danger',
  PARTIALLY_PAID: 'bg-gold-400/15 text-gold-700 dark:text-gold-300',
  REFUNDED: 'bg-black/5 text-smoke dark:bg-white/10 dark:text-ash',
  PARTIALLY_REFUNDED: 'bg-gold-400/15 text-gold-700 dark:text-gold-300',
  CANCELLED: 'bg-black/5 text-smoke dark:bg-white/10 dark:text-ash',
  FAILED: 'bg-danger/10 text-danger',
};

export default function AccSales() {
  const [range, setRange] = useState({ preset: 'month', from: '', to: '' });
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/accounting/sales', { params: { ...rangeParams(range), page: p, limit: 20 } });
      setSummary(data.data?.summary);
      setRows(data.data?.rows || []);
      setPage(data.meta?.page || p);
      setPages(data.meta?.pages || 1);
      setTotal(data.meta?.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, [range.preset, range.from, range.to]);

  const exportCSV = () => {
    downloadCSV(
      'sales',
      ['Order', 'Customer', 'Date', 'Subtotal', 'Discount', 'Delivery', 'Tax', 'Total', 'Paid', 'Due', 'PayStatus', 'OrderStatus'],
      rows.map((r) => [r.orderNumber, r.customer?.name, new Date(r.date).toLocaleDateString(), r.subtotal, r.discount, r.delivery, r.tax, r.total, r.paid, r.due, r.payStatus, r.orderStatus])
    );
  };

  const s = summary || {};
  const stats = [
    ['Orders', s.orders || 0], ['Subtotal', tk(s.subtotal)], ['Discount', tk(s.discount)],
    ['Delivery', tk(s.delivery)], ['Tax/VAT', tk(s.tax)], ['Refunds', tk(s.refunds)],
    ['Final Amount', tk(s.total)], ['Paid', tk(s.paid)], ['Due', tk(s.due)],
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Sales & Revenue</h1>
          <p className="text-sm text-gray-500 dark:text-ash">Product sales + delivery + tax, paid vs due</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRange value={range} onChange={setRange} />
          <button onClick={exportCSV} className="btn-outline text-xs">CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        {stats.map(([label, value]) => (
          <div key={label} className="card p-3">
            <p className="text-xs text-gray-500 dark:text-ash">{label}</p>
            <p className="font-bold mt-0.5">{loading ? '…' : value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f5f0] dark:bg-white/5">
            <tr>
              {['Order', 'Customer', 'Subtotal', 'Disc.', 'Deliv.', 'Tax', 'Total', 'Paid', 'Due', 'Status'].map((h) => (
                <th key={h} className="text-left p-3 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="p-8 text-center text-gray-500">No sales in range</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30]">
                  <td className="p-3 whitespace-nowrap">
                    <Link to={`/admin/orders/${r._id}`} className="text-primary-600 dark:text-gold-300 hover:underline">#{r.orderNumber}</Link>
                    <div className="text-[11px] text-gray-500">{new Date(r.date).toLocaleDateString()}</div>
                  </td>
                  <td className="p-3">{r.customer?.name || '—'}</td>
                  <td className="p-3">৳{r.subtotal}</td>
                  <td className="p-3">৳{r.discount}</td>
                  <td className="p-3">৳{r.delivery}</td>
                  <td className="p-3">৳{r.tax}</td>
                  <td className="p-3 font-semibold">৳{r.total}</td>
                  <td className="p-3 text-success">৳{r.paid}</td>
                  <td className="p-3 text-danger">৳{r.due}</td>
                  <td className="p-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLOR[r.payStatus] || ''}`}>
                      {r.payStatus?.replace(/_/g, ' ')}
                    </span>
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

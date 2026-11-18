import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { tk, downloadCSV } from '../../../utils/accFormat';

const STATUS_COLOR = {
  Requested: 'bg-gold-400/15 text-gold-700 dark:text-gold-300',
  Approved: 'bg-primary-700/10 text-primary-700 dark:text-gold-300',
  Rejected: 'bg-black/5 text-smoke dark:bg-white/10 dark:text-ash',
  Refunded: 'bg-success/15 text-success',
};

export default function AccRefunds() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fStatus, setFStatus] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/returns', { params: { limit: 50, ...(fStatus ? { status: fStatus } : {}) } });
      setList(data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fStatus]);

  const setStatus = async (id, status) => {
    const ok = status === 'Refunded'
      ? confirm('Mark REFUNDED? Money-out journal will post (revenue adjusted).')
      : true;
    if (!ok) return;
    try {
      await api.patch(`/returns/${id}/status`, { status, refundStatus: status === 'Refunded' ? 'Paid' : undefined });
      toast.success(`Status → ${status}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const claimed = list.filter((r) => ['Approved', 'Refunded'].includes(r.status)).reduce((s, r) => s + (r.refundAmount || 0), 0);
  const refunded = list.filter((r) => r.status === 'Refunded').reduce((s, r) => s + (r.refundAmount || 0), 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Refunds & Returns</h1>
          <p className="text-sm text-gray-500 dark:text-ash">Approve → accounting adjusts on Refunded</p>
        </div>
        <div className="flex gap-2">
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="input w-auto text-sm">
            <option value="">All</option>
            {['Requested', 'Approved', 'Rejected', 'Refunded'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => downloadCSV('refunds', ['Return#', 'Order', 'Type', 'Amount', 'Status', 'Refund', 'Date'], list.map((r) => [r.returnNumber, r.order?.orderNumber, r.type, r.refundAmount, r.status, r.refundStatus, new Date(r.createdAt).toLocaleDateString()]))}
            className="btn-outline text-xs"
          >
            CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 max-w-md">
        <div className="card p-3">
          <p className="text-xs text-gray-500 dark:text-ash">Claimed (Approved+Refunded)</p>
          <p className="font-bold">{tk(claimed)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-gray-500 dark:text-ash">Refunded (paid out)</p>
          <p className="font-bold">{tk(refunded)}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f5f0] dark:bg-white/5">
            <tr>
              {['Return', 'Order', 'Amount', 'Type', 'Status', 'Refund', 'Date', 'Actions'].map((h) => (
                <th key={h} className="text-left p-3 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500">No returns</td></tr>
            ) : (
              list.map((r) => (
                <tr key={r._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30]">
                  <td className="p-3 whitespace-nowrap">{r.returnNumber}</td>
                  <td className="p-3">{r.order?.orderNumber || '—'}</td>
                  <td className="p-3 font-semibold">৳{r.refundAmount}</td>
                  <td className="p-3 text-xs">{r.type}</td>
                  <td className="p-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLOR[r.status] || ''}`}>{r.status}</span>
                  </td>
                  <td className="p-3 text-xs">{r.refundStatus}</td>
                  <td className="p-3 text-xs text-gray-500 whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="p-3 whitespace-nowrap">
                    {r.status === 'Requested' && (
                      <>
                        <button onClick={() => setStatus(r._id, 'Approved')} className="text-xs text-primary-600 dark:text-gold-300 hover:underline mr-2">Approve</button>
                        <button onClick={() => setStatus(r._id, 'Rejected')} className="text-xs text-gray-500 hover:underline">Reject</button>
                      </>
                    )}
                    {r.status === 'Approved' && (
                      <button onClick={() => setStatus(r._id, 'Refunded')} className="text-xs text-success font-medium hover:underline">Mark Refunded</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { tk } from '../../../utils/accFormat';

const CODE_LABEL = { CASH: 'Cash', BANK: 'Bank Account', BKASH: 'bKash', NAGAD: 'Nagad', GATEWAY: 'Payment Gateway' };

export default function AccCashBank() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState('CASH');
  const [txns, setTxns] = useState([]);
  const [tLoading, setTLoading] = useState(false);
  const [tForm, setTForm] = useState({ toCode: 'BANK', amount: '', note: '' });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/accounting/accounts');
      setAccounts(data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const loadTxns = async (code) => {
    setTLoading(true);
    try {
      const { data } = await api.get(`/accounting/accounts/${code}/txns`, { params: { limit: 30 } });
      setTxns(data.data || []);
    } catch (_) {
      setTxns([]);
    } finally {
      setTLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    loadTxns(sel);
  }, [sel]);

  const transfer = async (e) => {
    e.preventDefault();
    try {
      await api.post('/accounting/transfer', { fromCode: sel, toCode: tForm.toCode, amount: Number(tForm.amount), note: tForm.note });
      toast.success('Transferred ✓');
      setTForm({ toCode: 'BANK', amount: '', note: '' });
      load();
      loadTxns(sel);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const cashAccounts = accounts.filter((a) => ['CASH', 'BANK', 'BKASH', 'NAGAD', 'GATEWAY'].includes(a.code));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Cash & Bank</h1>
      <p className="text-sm text-gray-500 dark:text-ash mb-4">Opening → current balance, debit/credit, transfers, history</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        {cashAccounts.map((a) => (
          <button
            key={a.code}
            type="button"
            onClick={() => setSel(a.code)}
            className={`card p-4 text-left transition ${sel === a.code ? 'ring-2 ring-primary-600 dark:ring-gold-400' : 'hover:shadow-md'}`}
          >
            <p className="text-xs text-gray-500 dark:text-ash">{CODE_LABEL[a.code] || a.name}</p>
            <p className="text-lg font-bold mt-1">{loading ? '…' : tk(a.balance)}</p>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <form onSubmit={transfer} className="card p-5 h-fit">
          <h3 className="font-semibold mb-3 text-sm">Transfer from {CODE_LABEL[sel] || sel}</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">To Account</label>
              <select className="input" value={tForm.toCode} onChange={(e) => setTForm({ ...tForm, toCode: e.target.value })}>
                {cashAccounts.filter((a) => a.code !== sel).map((a) => (
                  <option key={a.code} value={a.code}>{CODE_LABEL[a.code] || a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Amount (৳)</label>
              <input type="number" min="1" className="input" value={tForm.amount} onChange={(e) => setTForm({ ...tForm, amount: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Note</label>
              <input className="input" value={tForm.note} onChange={(e) => setTForm({ ...tForm, note: e.target.value })} placeholder="e.g. Cash → Bank 50,000" />
            </div>
            <button type="submit" className="btn-primary text-sm w-full">Transfer</button>
          </div>
        </form>

        <div className="lg:col-span-2 card p-5">
          <h3 className="font-semibold mb-3 text-sm">Transaction History — {CODE_LABEL[sel] || sel}</h3>
          {tLoading ? (
            <p className="text-sm text-gray-500 text-center py-6">Loading...</p>
          ) : txns.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No transactions yet</p>
          ) : (
            <div className="space-y-2 text-sm max-h-96 overflow-y-auto">
              {txns.map((t) => (
                <div key={t._id} className="flex justify-between gap-2 border-b border-[#e5e2da] dark:border-[#2a3b30] pb-2">
                  <div className="min-w-0">
                    <p className="truncate">{t.narration || t.voucherNo}</p>
                    <p className="text-[11px] text-gray-500">{new Date(t.date).toLocaleString()} · {t.voucherNo}</p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    {t.debit > 0 && <p className="text-success font-medium">+৳{t.debit}</p>}
                    {t.credit > 0 && <p className="text-danger font-medium">-৳{t.credit}</p>}
                    <p className="text-[11px] text-gray-500">Bal ৳{t.balanceAfter}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

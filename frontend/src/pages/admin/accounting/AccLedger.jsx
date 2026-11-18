import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import DateRange, { rangeParams } from '../../../components/accounting/DateRange';
import { downloadCSV } from '../../../utils/accFormat';

export default function AccLedger() {
  const [tab, setTab] = useState('ledger');
  const [range, setRange] = useState({ preset: 'month', from: '', to: '' });
  const [account, setAccount] = useState('');
  const [ref, setRef] = useState('');
  const [module, setModule] = useState('');
  const [list, setList] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [trial, setTrial] = useState(null);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      if (tab === 'ledger') {
        const { data } = await api.get('/accounting/ledger', {
          params: { ...rangeParams(range), page: p, limit: 50, ...(account ? { account } : {}), ...(ref ? { ref } : {}) },
        });
        setList(data.data || []);
        setPage(data.page || p);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
      } else if (tab === 'journals') {
        const { data } = await api.get('/accounting/journals', {
          params: { ...rangeParams(range), page: p, limit: 20, ...(module ? { module } : {}) },
        });
        setList(data.data || []);
        setPage(data.page || p);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
      } else {
        const { data } = await api.get('/accounting/trial-balance', { params: rangeParams(range) });
        setTrial(data.data);
        setList([]);
        setTotal(0);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, [tab, range.preset, range.from, range.to, account, module]);

  const voidIt = async (id) => {
    const reason = prompt('Void reason:');
    if (reason === null) return;
    try {
      await api.patch(`/accounting/journals/${id}/void`, { reason });
      toast.success('Voided via reversal');
      load(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Ledger & Journals</h1>
          <p className="text-sm text-gray-500 dark:text-ash">Centralized double-entry records</p>
        </div>
        <div className="flex gap-2 items-center">
          <DateRange value={range} onChange={setRange} />
          {['ledger', 'journals', 'trial'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-xs border capitalize ${tab === t ? 'bg-gray-900 text-white dark:bg-gold-400 dark:text-[#0a0f0c] border-transparent font-medium' : 'bg-white dark:bg-[#12241a] border-[#e5e2da] dark:border-[#2a3b30]'}`}
            >
              {t === 'trial' ? 'Trial Balance' : t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'ledger' && (
        <div className="flex gap-2 mb-4">
          <input value={account} onChange={(e) => setAccount(e.target.value.toUpperCase())} placeholder="Account code (e.g. CASH)" className="input w-48 text-sm" />
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Voucher / ref search..." className="input w-56 text-sm" />
          <button onClick={() => load(1)} className="btn-outline text-xs">Filter</button>
          <button
            onClick={() => downloadCSV('ledger', ['Date', 'Voucher', 'Account', 'Debit', 'Credit', 'Balance', 'Ref', 'Narration'], list.map((l) => [new Date(l.date).toLocaleString(), l.voucherNo, l.code, l.debit, l.credit, l.balanceAfter, `${l.referenceType}:${l.referenceId}`, l.narration]))}
            className="btn-outline text-xs"
          >
            CSV
          </button>
        </div>
      )}

      {tab === 'journals' && (
        <div className="flex gap-2 mb-4">
          <select value={module} onChange={(e) => setModule(e.target.value)} className="input w-auto text-sm">
            <option value="">All Modules</option>
            {['SALE', 'PAYMENT', 'EXPENSE', 'PURCHASE', 'REFUND', 'TRANSFER', 'TAX', 'ADJUSTMENT'].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}

      {tab === 'trial' ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f5f0] dark:bg-white/5">
              <tr>
                <th className="text-left p-3 font-medium">Account</th>
                <th className="text-right p-3 font-medium">Debit</th>
                <th className="text-right p-3 font-medium">Credit</th>
              </tr>
            </thead>
            <tbody>
              {(trial?.rows || []).map((r) => (
                <tr key={r._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30]">
                  <td className="p-3 font-medium">{r._id}</td>
                  <td className="p-3 text-right">৳{r.debit}</td>
                  <td className="p-3 text-right">৳{r.credit}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-primary-200 font-bold">
                <td className="p-3">Total {trial?.balanced ? '(balanced ✓)' : '(OUT OF BALANCE ❌)'}</td>
                <td className="p-3 text-right">৳{trial?.totals?.debit || 0}</td>
                <td className="p-3 text-right">৳{trial?.totals?.credit || 0}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : tab === 'ledger' ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f5f0] dark:bg-white/5">
              <tr>
                {['Date', 'Voucher', 'Account', 'Debit', 'Credit', 'Balance', 'Reference'].map((h) => (
                  <th key={h} className="text-left p-3 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">No ledger lines</td></tr>
              ) : (
                list.map((l) => (
                  <tr key={l._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30]">
                    <td className="p-3 text-xs whitespace-nowrap">{new Date(l.date).toLocaleString()}</td>
                    <td className="p-3 whitespace-nowrap">{l.voucherNo}</td>
                    <td className="p-3 font-medium">{l.code}</td>
                    <td className="p-3 text-success">{l.debit > 0 ? `৳${l.debit}` : '—'}</td>
                    <td className="p-3 text-danger">{l.credit > 0 ? `৳${l.credit}` : '—'}</td>
                    <td className="p-3 font-semibold">৳{l.balanceAfter}</td>
                    <td className="p-3 text-xs text-gray-500">{l.referenceType}:{String(l.referenceId).slice(-8)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-gray-500 card p-8 text-center">Loading...</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-gray-500 card p-8 text-center">No journals</p>
          ) : (
            list.map((j) => (
              <div key={j._id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-mono text-sm font-bold">{j.voucherNo}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary-700/10 text-primary-700 dark:text-gold-300">{j.module}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${j.status === 'VOIDED' ? 'bg-black/5 text-smoke dark:bg-white/10 dark:text-ash' : 'bg-success/15 text-success'}`}>{j.status}</span>
                  <span className="text-xs text-gray-500 ml-auto">{new Date(j.date).toLocaleString()} · Dr ৳{j.totalDebit} = Cr ৳{j.totalCredit}</span>
                  {j.status === 'POSTED' && (
                    <button onClick={() => voidIt(j._id)} className="text-xs text-red-500 hover:underline">Void</button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-2">{j.narration} {j.referenceType && `· ${j.referenceType}:${String(j.referenceId).slice(-8)}`}</p>
                <div className="text-xs space-y-1">
                  {(j.entries || []).map((e, i) => (
                    <div key={i} className="flex justify-between gap-2 border-t border-[#e5e2da]/50 dark:border-[#2a3b30] pt-1">
                      <span>{e.code} <span className="text-gray-500">· {e.name}</span></span>
                      <span>{e.debit > 0 ? `Dr ৳${e.debit}` : `Cr ৳${e.credit}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab !== 'trial' && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <p className="text-gray-500">Total {total}</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => load(page - 1)} className="btn-outline text-xs">← Prev</button>
            <span className="px-2 py-1">Page {page} / {pages}</span>
            <button disabled={page >= pages} onClick={() => load(page + 1)} className="btn-outline text-xs">Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}

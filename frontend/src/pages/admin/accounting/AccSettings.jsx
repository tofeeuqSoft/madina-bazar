import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';

export default function AccSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    taxRate: 0, taxName: 'VAT', vatMode: 'EXCLUSIVE', vatBin: '', gatewayFees: {}, paymentMethods: [],
    expenseCategories: [], fiscalYearStartMonth: 7,
  });
  const [accounts, setAccounts] = useState([]);
  const [newAcc, setNewAcc] = useState({ code: '', name: '', type: 'Asset' });
  const [feeKey, setFeeKey] = useState('');
  const [feeVal, setFeeVal] = useState('');
  const [newMethod, setNewMethod] = useState('');
  const [newCat, setNewCat] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/accounting/settings');
      const s = data.data?.settings || {};
      setForm({
        taxRate: s.taxRate ?? 0,
        taxName: s.taxName || 'VAT',
        vatMode: s.vatMode || 'EXCLUSIVE',
        vatBin: s.vatBin || '',
        gatewayFees: s.gatewayFees || {},
        paymentMethods: s.paymentMethods || [],
        expenseCategories: s.expenseCategories || [],
        fiscalYearStartMonth: s.fiscalYearStartMonth ?? 7,
      });
      setAccounts(data.data?.accounts || []);
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/accounting/settings', {
        taxRate: Number(form.taxRate) || 0,
        taxName: form.taxName,
        vatMode: form.vatMode,
        vatBin: form.vatBin,
        gatewayFees: form.gatewayFees,
        paymentMethods: form.paymentMethods,
        expenseCategories: form.expenseCategories,
        fiscalYearStartMonth: Number(form.fiscalYearStartMonth) || 7,
      });
      toast.success('Settings saved');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const addAccount = async (e) => {
    e.preventDefault();
    try {
      await api.post('/accounting/accounts', newAcc);
      toast.success('Account created');
      setNewAcc({ code: '', name: '', type: 'Asset' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const toggleAccount = async (a) => {
    if (a.isSystem) {
      toast.error('System accounts cannot be disabled');
      return;
    }
    // Account enable/disable is view-level only in this build
    toast('System accounts stay enabled; custom ones editable via API');
  };

  const listEditor = (title, items, onAdd, onRemove, placeholder, extra) => (
    <div className="card p-4">
      <h3 className="font-semibold mb-2 text-sm">{title}</h3>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(items || []).map((x) => (
          <span key={x} className="text-xs border border-[#e5e2da] dark:border-[#2a3b30] rounded-full px-2.5 py-1 inline-flex items-center gap-1">
            {x}
            <button type="button" onClick={() => onRemove(x)} className="text-red-500 font-bold">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input flex-1" placeholder={placeholder} value={extra.value} onChange={(e) => extra.set(e.target.value)} />
        <button type="button" onClick={onAdd} className="btn-outline text-xs whitespace-nowrap">+ Add</button>
      </div>
    </div>
  );

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Accounting Settings</h1>
      <p className="text-sm text-gray-500 dark:text-ash mb-4">Nothing financial is hard-coded — everything configurable here</p>

      <div className="card p-5 mb-4 space-y-4">
        <h3 className="font-semibold text-sm">Tax / VAT (NBR VAT & SD Act 2012 — standard 15%)</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Mode</label>
            <select className="input" value={form.vatMode} onChange={(e) => setForm({ ...form, vatMode: e.target.value })}>
              <option value="EXCLUSIVE">Exclusive — VAT added on top</option>
              <option value="INCLUSIVE">Inclusive — VAT inside price</option>
              <option value="DISABLED">Disabled — no VAT</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rate %</label>
            <input type="number" min="0" max="100" step="0.01" className="input" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input className="input" value={form.taxName} onChange={(e) => setForm({ ...form, taxName: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fiscal Year Start Month</label>
            <input type="number" min="1" max="12" className="input" value={form.fiscalYearStartMonth} onChange={(e) => setForm({ ...form, fiscalYearStartMonth: e.target.value })} />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-sm font-medium mb-1">BIN — Business Identification Number (invoice-এ দেখাবে)</label>
            <input className="input" placeholder="e.g. 001234567-0101" value={form.vatBin} onChange={(e) => setForm({ ...form, vatBin: e.target.value })} />
          </div>
        </div>
        <p className="text-[11px] text-gray-500">Exclusive: দামের উপর VAT যোগ হয় • Inclusive: দামের ভেতরেই VAT ধরা থাকে (মোট বদলায় না) • VAT-মুক্ত পণ্য (কাঁচা কৃষিপণ্য) Product পেজ থেকে Exempt করুন</p>

        <h3 className="font-semibold text-sm pt-2">Gateway Fees %</h3>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {Object.entries(form.gatewayFees || {}).map(([k, v]) => (
            <span key={k} className="text-xs border border-[#e5e2da] dark:border-[#2a3b30] rounded-full px-2.5 py-1 inline-flex items-center gap-1">
              {k}: {v}%
              <button
                type="button"
                onClick={() => setForm((f) => { const g = { ...f.gatewayFees }; delete g[k]; return { ...f, gatewayFees: g }; })}
                className="text-red-500 font-bold"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="input w-32" placeholder="METHOD" value={feeKey} onChange={(e) => setFeeKey(e.target.value.toUpperCase())} />
          <input type="number" min="0" step="0.01" className="input w-24" placeholder="%" value={feeVal} onChange={(e) => setFeeVal(e.target.value)} />
          <button
            type="button"
            onClick={() => {
              if (!feeKey) return;
              setForm((f) => ({ ...f, gatewayFees: { ...f.gatewayFees, [feeKey]: Number(feeVal) || 0 } }));
              setFeeKey('');
              setFeeVal('');
            }}
            className="btn-outline text-xs"
          >
            Set
          </button>
        </div>

        <button onClick={save} disabled={saving} className="btn-primary text-sm">
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div>
          {listEditor(
            'Payment Methods',
            form.paymentMethods,
            () => { if (newMethod.trim()) { setForm((f) => ({ ...f, paymentMethods: [...f.paymentMethods, newMethod.trim().toUpperCase()] })); setNewMethod(''); } },
            (x) => setForm((f) => ({ ...f, paymentMethods: f.paymentMethods.filter((m) => m !== x) })),
            'e.g. ROCKET',
            { value: newMethod, set: setNewMethod }
          )}
        </div>
        <div>
          {listEditor(
            'Expense Categories',
            form.expenseCategories,
            () => { if (newCat.trim()) { setForm((f) => ({ ...f, expenseCategories: [...f.expenseCategories, newCat.trim()] })); setNewCat(''); } },
            (x) => setForm((f) => ({ ...f, expenseCategories: f.expenseCategories.filter((m) => m !== x) })),
            'e.g. Staff Welfare',
            { value: newCat, set: setNewCat }
          )}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-1 text-sm">Chart of Accounts</h3>
        <p className="text-xs text-gray-500 mb-3">System rows are protected. Custom rows can be added below.</p>
        <form onSubmit={addAccount} className="flex gap-2 mb-3">
          <input className="input w-24" placeholder="CODE" value={newAcc.code} onChange={(e) => setNewAcc({ ...newAcc, code: e.target.value.toUpperCase() })} required />
          <input className="input flex-1" placeholder="Account name" value={newAcc.name} onChange={(e) => setNewAcc({ ...newAcc, name: e.target.value })} required />
          <select className="input w-32" value={newAcc.type} onChange={(e) => setNewAcc({ ...newAcc, type: e.target.value })}>
            {['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button type="submit" className="btn-outline text-xs whitespace-nowrap">+ Add</button>
        </form>
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f5f0] dark:bg-white/5 sticky top-0">
              <tr>
                <th className="text-left p-2 font-medium">Code</th>
                <th className="text-left p-2 font-medium">Name</th>
                <th className="text-left p-2 font-medium">Type</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30]" onClick={() => toggleAccount(a)}>
                  <td className="p-2 font-mono">{a.code}{a.isSystem ? ' 🔒' : ''}</td>
                  <td className="p-2">{a.name}</td>
                  <td className="p-2 text-xs">{a.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

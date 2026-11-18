import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import DateRange, { rangeParams } from '../../../components/accounting/DateRange';
import { tk } from '../../../utils/accFormat';

function Card({ label, value, sub, to }) {
  const inner = (
    <>
      <p className="text-xs text-gray-500 dark:text-ash">{label}</p>
      <p className="text-lg font-bold mt-1 truncate">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{sub}</p>}
    </>
  );
  return to ? (
    <Link to={to} className="card p-4 hover:shadow-md transition-shadow">{inner}</Link>
  ) : (
    <div className="card p-4">{inner}</div>
  );
}

function Bars({ data, labelKey = '_id', valueKey = 'sales', money = true, color = 'bg-primary-600 dark:bg-gold-400' }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey] || 0));
  if (!data.length) return <p className="text-sm text-gray-500 text-center py-6">No data</p>;
  return (
    <div className="space-y-1.5">
      {data.map((d) => (
        <div key={d[labelKey]} className="flex items-center gap-2 text-xs">
          <span className="w-20 truncate text-gray-500">{d[labelKey]}</span>
          <div className="flex-1 h-3 rounded bg-black/10 dark:bg-white/10 overflow-hidden">
            <div className={`h-full ${color} rounded`} style={{ width: `${Math.round(((d[valueKey] || 0) / max) * 100)}%` }} />
          </div>
          <span className="w-16 text-right font-medium">{money ? tk(d[valueKey]) : d[valueKey]}</span>
        </div>
      ))}
    </div>
  );
}

export default function AccDashboard() {
  const [range, setRange] = useState({ preset: 'month', from: '', to: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/accounting/dashboard', { params: rangeParams(range) });
      setData(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [range.preset, range.from, range.to]);

  const t = data?.today || {};
  const p = data?.period || {};
  const d = data?.dues || {};
  const b = data?.balances || {};
  const c = data?.charts || {};

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Accounting Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-ash">Financial command center</p>
        </div>
        <DateRange value={range} onChange={setRange} />
      </div>

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Today</h2>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <Card label="Today's Sales" value={loading ? '…' : tk(t.sales)} />
        <Card label="Today's Revenue" value={loading ? '…' : tk(t.revenue)} />
        <Card label="Today's Expense" value={loading ? '…' : tk(t.expense)} />
        <Card label="Today's Profit" value={loading ? '…' : tk(t.profit)} />
        <Card label="Today's Orders" value={loading ? '…' : t.orders} />
      </div>

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Period</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Card label="Sales" value={loading ? '…' : tk(p.sales)} to="/admin/accounting/sales" />
        <Card label="Gross Profit" value={loading ? '…' : tk(p.grossProfit)} to="/admin/accounting/statements" />
        <Card label="Net Profit" value={loading ? '…' : tk(p.netProfit)} to="/admin/accounting/statements" />
        <Card label="Expense" value={loading ? '…' : tk(p.expense)} to="/admin/accounting/expenses" />
        <Card label="Monthly Revenue" value={loading ? '…' : tk(p.revenue)} />
        <Card label="Delivery Revenue" value={loading ? '…' : tk(p.deliveryRevenue)} to="/admin/delivery-analytics" />
        <Card label="Pending Payments" value={loading ? '…' : tk(d.pendingPayments?.amount)} sub={`${d.pendingPayments?.count || 0} orders`} to="/admin/accounting/payments" />
        <Card label="Refund Pending" value={loading ? '…' : tk(d.refundPending?.amount)} sub={`${d.refundPending?.count || 0} cases`} to="/admin/accounting/refunds" />
        <Card label="Supplier Payable" value={loading ? '…' : tk(d.supplierPayable)} to="/admin/accounting/purchases" />
        <Card label="Customer Receivable" value={loading ? '…' : tk(d.customerReceivable)} to="/admin/accounting/customers" />
        <Card label="Cash Balance" value={loading ? '…' : tk(b.cash)} to="/admin/accounting/cash" />
        <Card label="Bank Balance" value={loading ? '…' : tk(b.bank)} to="/admin/accounting/cash" />
        <Card label="bKash / Nagad" value={loading ? '…' : `${tk(b.bkash)} / ${tk(b.nagad)}`} to="/admin/accounting/cash" />
        <Card label="Gateway Pending" value={loading ? '…' : tk(d.gatewayPending?.amount)} sub={`${d.gatewayPending?.count || 0} payments`} to="/admin/accounting/payments" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Daily Sales (14 days)</h3>
          <Bars data={c.daily || []} />
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Monthly Revenue (12 mo)</h3>
          <Bars data={(c.monthly || []).map((m) => ({ _id: m._id, sales: m.revenue }))} />
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Expense by Category</h3>
          <Bars data={(c.expByCat || []).map((e) => ({ _id: e._id, sales: e.total }))} color="bg-danger" />
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Profit (14 days revenue)</h3>
          <Bars data={(c.profitByDay || []).map((m) => ({ _id: m._id, sales: m.revenue }))} color="bg-success" />
        </div>
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold mb-3">Payment Method Distribution (paid)</h3>
          <div className="flex flex-wrap gap-2">
            {(c.payByMethod || []).map((m) => (
              <span key={m._id} className="text-xs border border-[#e5e2da] dark:border-[#2a3b30] rounded-full px-3 py-1.5">
                <b>{m._id}</b> · {tk(m.total)} ({m.count})
              </span>
            ))}
            {(!c.payByMethod || !c.payByMethod.length) && !loading && (
              <p className="text-sm text-gray-500">No paid payments in range</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import api from '../../../services/api';
import DateRange, { rangeParams } from '../../../components/accounting/DateRange';
import { downloadCSV, todayStr, tk } from '../../../utils/accFormat';

const REPORTS = [
  { key: 'sales-daily', label: 'Daily Sales', url: '/accounting/sales', map: (r) => [r.orderNumber, r.customer?.name, new Date(r.date).toLocaleDateString(), r.subtotal, r.discount, r.delivery, r.tax, r.total, r.paid, r.due, r.payStatus], head: ['Order', 'Customer', 'Date', 'Subtotal', 'Discount', 'Delivery', 'Tax', 'Total', 'Paid', 'Due', 'Status'], rows: (d) => d.rows },
  { key: 'expense-cat', label: 'Expense by Category', url: '/expenses', map: (r) => [r.title, r.category, r.amount, r.paymentMethod, r.status || 'ACTIVE', new Date(r.expenseDate).toLocaleDateString()], head: ['Title', 'Category', 'Amount', 'Method', 'Status', 'Date'], rows: (d) => d.data },
  { key: 'payments', label: 'Payments (method/gateway/pending)', url: '/accounting/payments', map: (r) => [r.paymentId, r.order?.orderNumber, r.amount, r.gatewayFee, r.netReceived, r.paymentMethod, r.status, new Date(r.createdAt).toLocaleDateString()], head: ['ID', 'Order', 'Amount', 'Fee', 'Net', 'Method', 'Status', 'Date'], rows: (d) => d },
  { key: 'purchase-due', label: 'Purchase Due', url: '/purchases', map: (r) => [r.invoiceNo || r._id, r.supplier?.name, r.totalCost, r.paidAmount, r.dueAmount, r.paymentStatus], head: ['Invoice', 'Supplier', 'Total', 'Paid', 'Due', 'Status'], rows: (d) => d.data },
  { key: 'ledger', label: 'Ledger', url: '/accounting/ledger', map: (r) => [new Date(r.date).toLocaleString(), r.voucherNo, r.code, r.debit, r.credit, r.balanceAfter, r.narration], head: ['Date', 'Voucher', 'Account', 'Debit', 'Credit', 'Balance', 'Narration'], rows: (d) => d },
  { key: 'journals', label: 'Journals', url: '/accounting/journals', map: (r) => [r.voucherNo, r.module, new Date(r.date).toLocaleString(), r.totalDebit, r.status, r.narration], head: ['Voucher', 'Module', 'Date', 'Amount', 'Status', 'Narration'], rows: (d) => d },
];

const GREEN = '#0b7a45';
const RED = '#dc2626';
const GOLD = '#d4a017';
const BLUE = '#2563eb';

const tooltipStyle = {
  background: '#12241a',
  border: '1px solid #2a3b30',
  borderRadius: 10,
  color: '#f5f2ea',
  fontSize: 12,
};
const moneyTick = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${v}`);
const moneyTip = (v) => `৳${Number(v || 0).toLocaleString()}`;

function ChartCard({ title, sub, legend, height = 260, children, empty }) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      {sub && <p className="text-[11px] text-gray-400 mb-3">{sub}</p>}
      {empty ? (
        <p className="text-xs text-gray-400 py-6 text-center">No data in this range</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>{children}</ResponsiveContainer>
      )}
      {legend && !empty && (
        <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-gray-500 dark:text-ash">
          {legend.map(([c, n]) => (
            <span key={n} className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c }} />{n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AccReports() {
  const [range, setRange] = useState({ preset: 'month', from: '', to: '' });
  const [dash, setDash] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [cf, setCf] = useState(null);
  const [tax, setTax] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = rangeParams(range);
      const [d, p, c, t] = await Promise.all([
        api.get('/accounting/dashboard', { params }).then((r) => r.data.data).catch(() => null),
        api.get('/accounting/profit-loss', { params }).then((r) => r.data.data).catch(() => null),
        api.get('/accounting/cash-flow', { params }).then((r) => r.data.data).catch(() => null),
        api.get('/accounting/tax', { params }).then((r) => r.data.data).catch(() => null),
      ]);
      setDash(d);
      setPnl(p);
      setCf(c);
      setTax(t);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [range.preset, range.from, range.to]);

  const run = async (rep) => {
    setRunning(rep.key);
    try {
      const { data } = await api.get(rep.url, { params: { ...rangeParams(range), limit: 500 } });
      const payload = rep.key === 'sales-daily' ? data.data : data.data ?? data;
      const rows = rep.rows(payload).map(rep.map);
      downloadCSV(`${rep.key}-${todayStr()}`, rep.head, rows);
      toast.success(`${rep.label}: ${rows.length} rows exported`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setRunning('');
    }
  };

  const period = dash?.period || {};
  const netVal = period.netProfit ?? pnl?.result?.net ?? 0;
  const kpis = [
    ['Revenue', period.revenue || 0, GREEN, true],
    ['Expenses', period.expense || 0, RED, true],
    ['Net Profit', netVal, netVal >= 0 ? GOLD : RED, true],
    ['Orders', period.orders || 0, BLUE, false],
  ];

  const daily = (dash?.charts?.daily || []).map((d) => ({ name: String(d._id).slice(5), Sales: d.sales }));
  const monthly = (dash?.charts?.monthly || []).map((d) => ({ name: String(d._id).slice(2), Revenue: d.revenue }));
  const pnlData = pnl ? [{ name: 'P&L', Revenue: pnl.revenue?.total || 0, Cost: pnl.cost?.total || 0, Net: pnl.result?.net || 0 }] : [];
  const cashData = cf ? [{ name: 'Cash', In: cf.totals?.cashIn || 0, Out: cf.totals?.cashOut || 0, Net: cf.totals?.net || 0 }] : [];
  const expCat = (dash?.charts?.expByCat || []).map((e) => ({ name: e._id || 'Other', Amount: e.total }));
  const payMethod = (dash?.charts?.payByMethod || []).map((p) => ({ name: `${p._id} (${p.count})`, Amount: p.total }));
  const dues = [
    { name: 'Customer Receivable', Amount: dash?.dues?.customerReceivable || 0 },
    { name: 'Pending Payments', Amount: dash?.dues?.pendingPayments?.amount || 0 },
    { name: 'Supplier Payable', Amount: dash?.dues?.supplierPayable || 0 },
    { name: 'Refund Pending', Amount: dash?.dues?.refundPending?.amount || 0 },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Financial Reports</h1>
          <p className="text-sm text-gray-500 dark:text-ash">Interactive bar charts · audited journals only</p>
        </div>
        <div className="card !p-2 px-3">
          <DateRange value={range} onChange={setRange} />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 card p-8 text-center">Loading charts...</p>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {kpis.map(([label, value, color, money]) => (
              <div key={label} className="card p-4">
                <p className="text-xs text-gray-500 dark:text-ash">{label}</p>
                <p className="text-xl font-bold mt-1" style={{ color }}>{money ? tk(value) : value}</p>
              </div>
            ))}
          </div>

          {/* Daily + monthly */}
          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <ChartCard title="Daily Sales — last 14 days" sub="Hover a bar for exact ৳" empty={!daily.length} legend={[[GREEN, 'Sales ৳']]}>
              <BarChart data={daily} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={moneyTick} width={48} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [moneyTip(v), 'Sales']} />
                <Bar dataKey="Sales" fill={GREEN} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ChartCard>
            <ChartCard title="Monthly Revenue — last 12 months" sub="Seasonality at a glance" empty={!monthly.length} legend={[[GREEN, 'Revenue ৳']]}>
              <BarChart data={monthly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={moneyTick} width={48} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [moneyTip(v), 'Revenue']} />
                <Bar dataKey="Revenue" fill={GREEN} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ChartCard>
          </div>

          {/* P&L + Cash flow */}
          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <ChartCard
              title="Profit & Loss"
              sub={pnl ? `Gross ${tk(pnl.result?.gross)} (${pnl.result?.grossMargin}%) · Net ${tk(pnl.result?.net)} (${pnl.result?.netMargin}%)` : '—'}
              empty={!pnlData.length}
              legend={[[GREEN, 'Revenue'], [RED, 'Cost'], [GOLD, 'Net']]}
            >
              <BarChart data={pnlData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={moneyTick} width={48} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [moneyTip(v), n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Revenue" fill={GREEN} radius={[5, 5, 0, 0]} />
                <Bar dataKey="Cost" fill={RED} radius={[5, 5, 0, 0]} />
                <Bar dataKey="Net" fill={GOLD} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ChartCard>
            <ChartCard
              title="Cash Flow"
              sub={cf ? `In ${tk(cf.totals?.cashIn)} · Out ${tk(cf.totals?.cashOut)}` : '—'}
              empty={!cashData.length}
              legend={[[GREEN, 'In'], [RED, 'Out'], [BLUE, 'Net']]}
            >
              <BarChart data={cashData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={moneyTick} width={48} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [moneyTip(v), n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="In" fill={GREEN} radius={[5, 5, 0, 0]} />
                <Bar dataKey="Out" fill={RED} radius={[5, 5, 0, 0]} />
                <Bar dataKey="Net" fill={BLUE} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ChartCard>
          </div>

          {/* Expense + payments (horizontal) */}
          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <ChartCard title="Expense by Category" empty={!expCat.length}>
              <BarChart data={expCat} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={moneyTick} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [moneyTip(v), 'Expense']} />
                <Bar dataKey="Amount" radius={[0, 5, 5, 0]}>
                  {expCat.map((_, i) => <Cell key={i} fill={i === 0 ? RED : '#f87171'} />)}
                </Bar>
              </BarChart>
            </ChartCard>
            <ChartCard title="Collections by Payment Method" empty={!payMethod.length}>
              <BarChart data={payMethod} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={moneyTick} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [moneyTip(v), 'Collected']} />
                <Bar dataKey="Amount" radius={[0, 5, 5, 0]}>
                  {payMethod.map((_, i) => <Cell key={i} fill={i === 0 ? BLUE : '#60a5fa'} />)}
                </Bar>
              </BarChart>
            </ChartCard>
          </div>

          {/* Tax + dues */}
          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <ChartCard
              title={tax ? `${tax.name} / Tax` : 'Tax / VAT'}
              sub={tax ? `Rate ${tax.rate}% · ${tax.orders} orders` : '—'}
              empty={!tax}
              legend={[[GREEN, 'Collected'], [GOLD, 'Payable']]}
            >
              <BarChart
                data={tax ? [{ name: 'VAT', Collected: tax.collected, Payable: tax.payable }] : []}
                margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={moneyTick} width={48} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [moneyTip(v), n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Collected" fill={GREEN} radius={[5, 5, 0, 0]} />
                <Bar dataKey="Payable" fill={GOLD} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ChartCard>
            <ChartCard title="Dues & Receivables" empty={false}>
              <BarChart data={dues} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={moneyTick} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [moneyTip(v), 'Amount']} />
                <Bar dataKey="Amount" fill={GOLD} radius={[0, 5, 5, 0]} />
              </BarChart>
            </ChartCard>
          </div>

          {/* CSV exports (kept) */}
          <div className="card p-5">
            <h3 className="font-semibold text-sm mb-1">Detailed Exports</h3>
            <p className="text-[11px] text-gray-400 mb-3">CSV (Excel-compatible) row data behind the charts</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {REPORTS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => run(r)}
                  disabled={!!running}
                  className="flex items-center justify-between gap-2 border border-[#e5e2da] dark:border-[#2a3b30] rounded-lg px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span>{r.label}</span>
                  <span className="text-primary-600 dark:text-gold-300 font-medium">{running === r.key ? '…' : 'CSV ↓'}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-3">For PDF: browser Print → Save as PDF. P&L/Cash Flow/Tax tables live in Statements.</p>
          </div>
        </>
      )}
    </div>
  );
}

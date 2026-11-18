import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { reportService, financeService } from '../../services/reportService';

const TABS = [
  { key: 'sales', label: 'Sales' },
  { key: 'purchase', label: 'Purchase' },
  { key: 'expense', label: 'Expense' },
  { key: 'profit', label: 'Profit & Loss' },
  { key: 'balance', label: 'Balance Sheet' },
  { key: 'cash', label: 'Cash Flow' },
  { key: 'custDue', label: 'Customer Due' },
  { key: 'supDue', label: 'Supplier Due' },
  { key: 'payment', label: 'Payment' },
  { key: 'refund', label: 'Refund' },
  { key: 'ret', label: 'Return' },
  { key: 'tax', label: 'Tax' },
  { key: 'inv', label: 'Inventory Valuation' },
  { key: 'cogs', label: 'COGS' },
  { key: 'gross', label: 'Gross Profit' },
  { key: 'net', label: 'Net Profit' },
  { key: 'entries', label: 'Entries' },
];

const tk = (v) => `৳${Number(v || 0).toLocaleString()}`;
const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

function Stat({ label, value }) {
  return (
    <div className="bg-white dark:bg-[#12241a] rounded-xl border border-[#e5e2da] dark:border-[#2a3b30] p-4">
      <p className="text-xs text-gray-500 dark:text-ash">{label}</p>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}

function Table({ head, rows, empty = 'No data yet' }) {
  if (!rows?.length) return <p className="text-sm text-gray-500 dark:text-ash py-6 text-center">{empty}</p>;
  return (
    <div className="overflow-x-auto border border-[#e5e2da] dark:border-[#2a3b30] rounded-xl bg-white dark:bg-[#12241a]">
      <table className="w-full text-sm">
        <thead className="bg-[#f7f5f0] dark:bg-white/5">
          <tr>{head.map((h) => <th key={h} className="text-left p-3 font-medium text-gray-600 dark:text-ash whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30] hover:bg-[#f7f5f0] dark:hover:bg-white/5">{r.map((c, j) => <td key={j} className="p-3 whitespace-nowrap">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function toCSV(rows) {
  return rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}
function downloadCSV(name, head, rows) {
  const blob = new Blob([[head.join(','), toCSV(rows)].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Reports() {
  const [tab, setTab] = useState('sales');
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [taxRate, setTaxRate] = useState(0);
  const [summary, setSummary] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const params = useMemo(() => ({ from, to, taxRate }), [from, to, taxRate]);

  useEffect(() => {
    reportService.summary({ from, to }).then((r) => setSummary(r.data)).catch(() => {});
  }, [from, to]);

  useEffect(() => {
    if (tab === 'entries') return;
    setLoading(true);
    setErr('');
    const run = async () => {
      switch (tab) {
        case 'sales': return (await reportService.sales(params)).data;
        case 'purchase': return (await reportService.purchases(params)).data;
        case 'expense': return (await reportService.expenses(params)).data;
        case 'profit': return (await reportService.profitLoss(params)).data;
        case 'balance': return (await reportService.balanceSheet({ asOf: to })).data;
        case 'cash': return (await reportService.cashFlow(params)).data;
        case 'custDue': return (await reportService.customerDue()).data;
        case 'supDue': return (await reportService.supplierDue()).data;
        case 'payment': return (await reportService.payments(params)).data;
        case 'refund': return (await reportService.refunds(params)).data;
        case 'ret': return (await reportService.returns(params)).data;
        case 'tax': return (await reportService.tax(params)).data;
        case 'inv': return (await reportService.inventory({ limit: 200 })).data;
        case 'cogs': return (await reportService.cogs(params)).data;
        case 'gross': return (await reportService.grossProfit(params)).data;
        case 'net': return (await reportService.netProfit(params)).data;
        default: return null;
      }
    };
    run().then(setData).catch((e) => setErr(e.response?.data?.message || e.message)).finally(() => setLoading(false));
  }, [tab, from, to, taxRate]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Financial Reports</h1>
      <p className="text-sm text-gray-500 dark:text-ash mb-4">Sales, purchases, expenses, profit, dues, tax & inventory — all in one place.</p>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
          <Stat label="Revenue" value={tk(summary.revenue)} />
          <Stat label="Orders" value={summary.orders} />
          <Stat label="COGS" value={tk(summary.cogs)} />
          <Stat label="Gross" value={tk(summary.gross)} />
          <Stat label="Expenses" value={tk(summary.expenses)} />
          <Stat label="Net" value={tk(summary.net)} />
        </div>
      )}

      {/* Filters */}
      {tab !== 'entries' && !['custDue', 'supDue', 'inv'].includes(tab) && (
        <div className="flex flex-wrap gap-2 mb-4 items-end">
          <label className="text-xs">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-[#e5e2da] dark:border-[#2a3b30] rounded px-2 py-1 ml-1 bg-white dark:bg-[#0a0f0c]" /></label>
          <label className="text-xs">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-[#e5e2da] dark:border-[#2a3b30] rounded px-2 py-1 ml-1 bg-white dark:bg-[#0a0f0c]" /></label>
          {tab === 'tax' && (
            <label className="text-xs">Tax % <input type="number" min="0" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="border border-[#e5e2da] dark:border-[#2a3b30] rounded px-2 py-1 ml-1 bg-white dark:bg-[#0a0f0c] w-20" /></label>
          )}
          {tab === 'balance' && <span className="text-xs text-gray-500 dark:text-ash">As of: {to}</span>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setData(null); }}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border ${tab === t.key ? 'bg-[#0e4430] text-white dark:bg-gold-400 dark:text-[#0a0f0c]' : 'bg-white dark:bg-[#12241a] hover:bg-[#f7f5f0] dark:hover:bg-white/10 border-[#e5e2da] dark:border-[#2a3b30]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500 dark:text-ash">Loading…</p>}
      {err && <p className="text-sm text-red-600 dark:text-danger mb-3">{err}</p>}

      {!loading && !err && data && <TabBody tab={tab} data={data} from={from} to={to} />}
      {tab === 'entries' && <Entries />}
    </div>
  );
}

function TabBody({ tab, data, from, to }) {
  switch (tab) {
    case 'sales': {
      const t = data.totals;
      const rows = (data.list || []).map((o) => [o.orderNumber, o.customer?.name || '—', o.orderItems?.length, tk(o.totalAmount), o.paymentMethod, o.paymentStatus, o.orderStatus, new Date(o.createdAt).toLocaleDateString()]);
      return (<>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <Stat label="Orders" value={t.orders} /><Stat label="Items" value={t.items} /><Stat label="Revenue" value={tk(t.revenue)} /><Stat label="Discount" value={tk(t.discount)} /><Stat label="Avg Order" value={tk(t.avgOrder)} />
        </div>
        <div className="flex justify-end mb-2"><button onClick={() => downloadCSV(`sales-${from}-${to}`, ['Order', 'Customer', 'Items', 'Total', 'PayMethod', 'PayStatus', 'Status', 'Date'], rows)} className="text-xs border border-[#e5e2da] dark:border-[#2a3b30] rounded px-3 py-1.5 bg-white dark:bg-[#12241a]">Export CSV</button></div>
        <Table head={['Order', 'Customer', 'Items', 'Total', 'Method', 'Pay', 'Status', 'Date']} rows={rows} />
      </>);
    }
    case 'purchase': {
      const t = data.totals;
      const rows = (data.list || []).map((p) => [p.invoiceNo || '—', p.supplier?.name || '—', p.items?.length, tk(p.totalCost), tk(p.paidAmount), tk(p.dueAmount), p.paymentStatus, new Date(p.purchaseDate).toLocaleDateString()]);
      return (<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"><Stat label="Bills" value={t.bills} /><Stat label="Total Cost" value={tk(t.totalCost)} /><Stat label="Paid" value={tk(t.paid)} /><Stat label="Due" value={tk(t.due)} /></div>
        <div className="flex justify-end mb-2"><button onClick={() => downloadCSV(`purchase-${from}-${to}`, ['Invoice', 'Supplier', 'Items', 'Cost', 'Paid', 'Due', 'Status', 'Date'], rows)} className="text-xs border border-[#e5e2da] dark:border-[#2a3b30] rounded px-3 py-1.5 bg-white dark:bg-[#12241a]">Export CSV</button></div>
        <Table head={['Invoice', 'Supplier', 'Items', 'Cost', 'Paid', 'Due', 'Status', 'Date']} rows={rows} />
        <h3 className="font-semibold mt-6 mb-2 text-sm">By Supplier</h3>
        <Table head={['Supplier', 'Company', 'Bills', 'Cost', 'Paid', 'Due']} rows={(data.bySupplier || []).map((s) => [s.supplier || '—', s.company || '', s.bills, tk(s.cost), tk(s.paid), tk(s.due)])} />
      </>);
    }
    case 'expense': {
      const t = data.totals;
      return (<>
        <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 mb-4"><Stat label="Entries" value={t.count} /><Stat label="Total" value={tk(t.amount)} /></div>
        <h3 className="font-semibold mb-2 text-sm">By Category</h3>
        <Table head={['Category', 'Count', 'Amount']} rows={(data.byCategory || []).map((c) => [c._id, c.count, tk(c.amount)])} />
        <h3 className="font-semibold mt-4 mb-2 text-sm">Details</h3>
        <Table head={['Title', 'Category', 'Amount', 'Method', 'Date']} rows={(data.list || []).map((e) => [e.title, e.category, tk(e.amount), e.paymentMethod, new Date(e.expenseDate).toLocaleDateString()])} />
      </>);
    }
    case 'profit':
    case 'net': {
      const d = data.income ? data : { income: { revenue: data.result ? undefined : 0 }, cost: {}, result: {} };
      const inc = data.income || {};
      const result = data.result || {};
      return (<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Stat label="Revenue" value={tk(inc.revenue)} /><Stat label="COGS" value={tk(data.cost?.cogs)} />
          <Stat label="Gross" value={`${tk(result.gross)} (${result.grossMargin || 0}%)`} />
          <Stat label="Net" value={`${tk(result.net)} (${result.netMargin || 0}%)`} />
        </div>
        <Table head={['Line', 'Amount']} rows={[
          ['Revenue', tk(inc.revenue)], ['(−) COGS', tk(data.cost?.cogs)], ['= Gross Profit', tk(result.gross)],
          ['(−) Expenses', tk(data.cost?.expenses)], ['(−) Refunds', tk(data.cost?.refunds)], ['= Net Profit', tk(result.net)],
          ['Discount given', tk(inc.discount)], ['Delivery income', tk(inc.deliveryIncome)],
        ]} />
      </>);
    }
    case 'gross': {
      const t = data.totals;
      return (<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"><Stat label="Revenue" value={tk(t.revenue)} /><Stat label="COGS" value={tk(t.cogs)} /><Stat label="Gross" value={tk(t.revenue - t.cogs)} /><Stat label="Margin" value={`${t.revenue ? (((t.revenue - t.cogs) / t.revenue) * 100).toFixed(2) : 0}%`} /></div>
        <Table head={['Date', 'Revenue', 'COGS', 'Gross']} rows={(data.byDay || []).map((d) => [d._id, tk(d.revenue), tk(d.cogs), tk(d.gross)])} />
      </>);
    }
    case 'cogs': {
      return (<>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4"><Stat label="Revenue" value={tk(data.totals?.revenue)} /><Stat label="COGS" value={tk(data.totals?.cogs)} /><Stat label="Gross" value={tk(data.gross)} /></div>
        <p className="text-xs text-gray-500 dark:text-ash mb-2">{data.note}</p>
        <h3 className="font-semibold mb-2 text-sm">Top products by COGS</h3>
        <Table head={['Product', 'Qty', 'Revenue', 'COGS', 'Gross']} rows={(data.byProduct || []).map((p) => [p._id, p.qty, tk(p.revenue), tk(p.cogs), tk(p.gross)])} />
      </>);
    }
    case 'balance': {
      const d = data;
      return (<>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <Stat label="Total Assets" value={tk(d.assets?.total)} /><Stat label="Liabilities" value={tk(d.liabilities?.total)} /><Stat label="Equity" value={tk(d.equity)} />
        </div>
        <Table head={['Line', 'Amount']} rows={[
          ['Inventory', tk(d.assets?.inventory)], ['Receivables (customer due)', tk(d.assets?.receivables)], ['Cash', tk(d.assets?.cash)], ['Total Assets', tk(d.assets?.total)],
          ['Supplier Due', tk(d.liabilities?.supplierDue)], ['Total Liabilities', tk(d.liabilities?.total)], ['Equity (A − L)', tk(d.equity)],
        ]} />
      </>);
    }
    case 'cash': {
      const t = data.totals;
      return (<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"><Stat label="Inflow" value={tk(t.inflow)} /><Stat label="Outflow" value={tk(t.outflow)} /><Stat label="Net" value={tk(t.net)} /><Stat label="Bills paid (purchase)" value={tk(t.purchaseOut)} /></div>
        <Table head={['Line', 'Amount']} rows={[['Sales collected', tk(t.inflow)], ['(−) Purchases paid', tk(t.purchaseOut)], ['(−) Expenses', tk(t.expenseOut)], ['(−) Refunds paid', tk(t.refundOut)], ['= Net cash', tk(t.net)]]} />
      </>);
    }
    case 'custDue':
      return (<>
        <div className="grid grid-cols-2 gap-3 mb-4"><Stat label="Customers owing" value={data.totals?.customers} /><Stat label="Total due" value={tk(data.totals?.due)} /></div>
        <Table head={['Customer', 'Phone', 'Orders', 'Due']} rows={(data.list || []).map((r) => [r.customer || 'Guest', r.phone || '', r.orders, tk(r.due)])} />
      </>);
    case 'supDue':
      return (<>
        <div className="grid grid-cols-2 gap-3 mb-4"><Stat label="Suppliers owed" value={data.totals?.suppliers} /><Stat label="Total due" value={tk(data.totals?.due)} /></div>
        <Table head={['Supplier', 'Company', 'Bills', 'Due']} rows={(data.list || []).map((r) => [r.supplier || '—', r.company || '', r.bills, tk(r.due)])} />
      </>);
    case 'payment': {
      const t = data.totals;
      return (<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"><Stat label="Orders" value={t.orders} /><Stat label="Amount" value={tk(t.amount)} /><Stat label="Collected" value={tk(t.collected)} /><Stat label="Pending" value={tk(t.pending)} /></div>
        <h3 className="font-semibold mb-2 text-sm">By Method</h3>
        <Table head={['Method', 'Orders', 'Amount', 'Collected']} rows={(data.byMethod || []).map((m) => [m._id, m.orders, tk(m.amount), tk(m.paid)])} />
        <h3 className="font-semibold mt-4 mb-2 text-sm">By Status</h3>
        <Table head={['Status', 'Orders', 'Amount']} rows={(data.byStatus || []).map((s) => [s._id, s.orders, tk(s.amount)])} />
      </>);
    }
    case 'refund':
      return (<>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4"><Stat label="Claims" value={data.totals?.count} /><Stat label="Claimed" value={tk(data.totals?.claimed)} /><Stat label="Refunded" value={tk(data.totals?.refunded)} /></div>
        <Table head={['Return #', 'Order', 'Amount', 'Status', 'Refund', 'Date']} rows={(data.list || []).map((r) => [r.returnNumber, r.order?.orderNumber || '', tk(r.refundAmount), r.status, r.refundStatus, new Date(r.createdAt).toLocaleDateString()])} />
      </>);
    case 'ret':
      return (<>
        <div className="grid grid-cols-2 gap-3 mb-4"><Stat label="Returns" value={data.totals?.count} /><Stat label="Amount" value={tk(data.totals?.amount)} /></div>
        <Table head={['Type', 'Count', 'Amount']} rows={(data.byType || []).map((t) => [t._id, t.count, tk(t.amount)])} />
        <h3 className="font-semibold mt-4 mb-2 text-sm">Details</h3>
        <Table head={['Return #', 'Order', 'Type', 'Amount', 'Status', 'Date']} rows={(data.list || []).map((r) => [r.returnNumber, r.order?.orderNumber || '', r.type, tk(r.refundAmount), r.status, new Date(r.createdAt).toLocaleDateString()])} />
      </>);
    case 'tax': {
      const t = data.totals;
      return (<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"><Stat label="Orders" value={t.orders} /><Stat label="Taxable" value={tk(t.taxable)} /><Stat label={`Tax (${t.taxRate}%)`} value={tk(t.tax)} /><Stat label="Revenue" value={tk(t.revenue)} /></div>
        <Table head={['Date', 'Taxable', 'Tax']} rows={(data.byDay || []).map((d) => [d._id, tk(d.taxable), tk(d.tax)])} />
      </>);
    }
    case 'inv': {
      const t = data.totals;
      return (<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"><Stat label="SKUs" value={t.skus} /><Stat label="Units" value={t.units} /><Stat label="Cost Value" value={tk(t.costValue)} /><Stat label="Retail Value" value={tk(t.retailValue)} /></div>
        <Table head={['Product', 'SKU', 'Stock', 'Unit Cost', 'Cost Value', 'Est?']} rows={(data.list || []).map((p) => [p.name, p.sku || '', p.stock, tk(p.unitCost), tk(p.costValue), p.estimated ? 'Yes' : ''])} />
      </>);
    }
    default: return null;
  }
}

function Entries() {
  const [suppliers, setSuppliers] = useState([]);
  const [msg, setMsg] = useState('');
  const [exp, setExp] = useState({ title: '', category: 'Other', amount: '', paymentMethod: 'Cash' });
  const [sup, setSup] = useState({ name: '', company: '', phone: '' });
  const [pur, setPur] = useState({ supplier: '', invoiceNo: '', name: '', quantity: 1, costPrice: '', paidAmount: '' });
  const [ret, setRet] = useState({ order: '', refundAmount: '', reason: '' });

  const load = async () => {
    try {
      const s = await financeService.suppliers.list({ limit: 100 });
      setSuppliers(s.data || []);
    } catch { /* ignore */ }
  };
  useEffect(() => { load(); }, []);

  const submit = async (fn, okMsg, reset) => {
    setMsg('');
    try { await fn(); setMsg(okMsg); reset?.(); load(); }
    catch (e) { setMsg(e.response?.data?.message || e.message); }
  };

  const inp = 'border border-[#e5e2da] dark:border-[#2a3b30] rounded px-2 py-1.5 text-sm w-full bg-white dark:bg-[#0a0f0c]';
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {msg && <p className="md:col-span-2 text-sm bg-blue-50 dark:bg-gold-400/10 border border-blue-200 dark:border-gold-400/30 rounded p-2">{msg}</p>}

      <div className="bg-white dark:bg-[#12241a] border border-[#e5e2da] dark:border-[#2a3b30] rounded-xl p-4">
        <h3 className="font-semibold mb-2">+ Expense</h3>
        <div className="space-y-2">
          <input className={inp} placeholder="Title" value={exp.title} onChange={(e) => setExp({ ...exp, title: e.target.value })} />
          <div className="flex gap-2">
            <select className={inp} value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value })}>
              {['Rent', 'Salary', 'Utility', 'Delivery', 'Marketing', 'Packaging', 'Maintenance', 'Purchase', 'Refund', 'Other'].map((c) => <option key={c}>{c}</option>)}
            </select>
            <input className={inp} type="number" placeholder="Amount" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} />
          </div>
          <button onClick={() => submit(() => financeService.expenses.create({ ...exp, amount: Number(exp.amount) }), 'Expense saved ✓', () => setExp({ title: '', category: 'Other', amount: '', paymentMethod: 'Cash' }))}
            className="bg-[#0e4430] dark:bg-gold-400 dark:text-[#0a0f0c] text-white text-sm rounded px-4 py-2">Save Expense</button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#12241a] border border-[#e5e2da] dark:border-[#2a3b30] rounded-xl p-4">
        <h3 className="font-semibold mb-2">+ Supplier</h3>
        <div className="space-y-2">
          <input className={inp} placeholder="Name *" value={sup.name} onChange={(e) => setSup({ ...sup, name: e.target.value })} />
          <div className="flex gap-2">
            <input className={inp} placeholder="Company" value={sup.company} onChange={(e) => setSup({ ...sup, company: e.target.value })} />
            <input className={inp} placeholder="Phone" value={sup.phone} onChange={(e) => setSup({ ...sup, phone: e.target.value })} />
          </div>
          <button onClick={() => submit(() => financeService.suppliers.create(sup), 'Supplier saved ✓', () => setSup({ name: '', company: '', phone: '' }))}
            className="bg-[#0e4430] dark:bg-gold-400 dark:text-[#0a0f0c] text-white text-sm rounded px-4 py-2">Save Supplier</button>
        </div>
        {!!suppliers.length && <p className="text-xs text-gray-500 dark:text-ash mt-2">{suppliers.length} suppliers: {suppliers.slice(0, 5).map((s) => s.name).join(', ')}{suppliers.length > 5 ? '…' : ''}</p>}
      </div>

      <div className="bg-white dark:bg-[#12241a] border border-[#e5e2da] dark:border-[#2a3b30] rounded-xl p-4">
        <h3 className="font-semibold mb-2">+ Purchase Bill</h3>
        <div className="space-y-2">
          <select className={inp} value={pur.supplier} onChange={(e) => setPur({ ...pur, supplier: e.target.value })}>
            <option value="">Select supplier *</option>
            {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}{s.company ? ` (${s.company})` : ''}</option>)}
          </select>
          <div className="flex gap-2">
            <input className={inp} placeholder="Invoice #" value={pur.invoiceNo} onChange={(e) => setPur({ ...pur, invoiceNo: e.target.value })} />
            <input className={inp} placeholder="Item name *" value={pur.name} onChange={(e) => setPur({ ...pur, name: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <input className={inp} type="number" placeholder="Qty" value={pur.quantity} onChange={(e) => setPur({ ...pur, quantity: e.target.value })} />
            <input className={inp} type="number" placeholder="Cost/unit" value={pur.costPrice} onChange={(e) => setPur({ ...pur, costPrice: e.target.value })} />
            <input className={inp} type="number" placeholder="Paid" value={pur.paidAmount} onChange={(e) => setPur({ ...pur, paidAmount: e.target.value })} />
          </div>
          <button onClick={() => submit(() => financeService.purchases.create({
            supplier: pur.supplier, invoiceNo: pur.invoiceNo || undefined,
            items: [{ name: pur.name, quantity: Number(pur.quantity) || 1, costPrice: Number(pur.costPrice) || 0 }],
            paidAmount: Number(pur.paidAmount) || 0,
          }), 'Purchase saved ✓ (stock updated if product matched)', () => setPur({ supplier: '', invoiceNo: '', name: '', quantity: 1, costPrice: '', paidAmount: '' }))}
            className="bg-[#0e4430] dark:bg-gold-400 dark:text-[#0a0f0c] text-white text-sm rounded px-4 py-2">Save Purchase</button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#12241a] border border-[#e5e2da] dark:border-[#2a3b30] rounded-xl p-4">
        <h3 className="font-semibold mb-2">+ Return / Refund</h3>
        <div className="space-y-2">
          <input className={inp} placeholder="Order ID (optional)" value={ret.order} onChange={(e) => setRet({ ...ret, order: e.target.value })} />
          <div className="flex gap-2">
            <input className={inp} type="number" placeholder="Refund amount *" value={ret.refundAmount} onChange={(e) => setRet({ ...ret, refundAmount: e.target.value })} />
            <input className={inp} placeholder="Reason" value={ret.reason} onChange={(e) => setRet({ ...ret, reason: e.target.value })} />
          </div>
          <button onClick={() => submit(() => financeService.returns.create({
            order: ret.order || undefined, type: 'SALE_RETURN',
            items: [], refundAmount: Number(ret.refundAmount) || 0, reason: ret.reason, status: 'Approved',
          }), 'Return saved ✓', () => setRet({ order: '', refundAmount: '', reason: '' }))}
            className="bg-[#0e4430] dark:bg-gold-400 dark:text-[#0a0f0c] text-white text-sm rounded px-4 py-2">Save Return</button>
          <p className="text-xs text-gray-500 dark:text-ash">Tip: also update product cost via Products → Edit → Cost Price for accurate COGS.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#12241a] border border-[#e5e2da] dark:border-[#2a3b30] rounded-xl p-4 md:col-span-2">
        <h3 className="font-semibold mb-2">How it works</h3>
        <ul className="text-xs text-gray-600 dark:text-ash list-disc ml-4 space-y-1">
          <li>Sales, Payments, Customer Due, Tax come live from <b>Orders</b> — no setup needed.</li>
          <li>COGS / Gross / Inventory Valuation use <b>Product.costPrice</b>; missing costs fall back to regularPrice (marked Est).</li>
          <li>Purchase / Supplier Due need <b>Purchase bills</b> above. Creating a bill also bumps stock.</li>
          <li>Expense / P&amp;L / Net / Cash Flow / Balance Sheet need <b>Expenses</b> above.</li>
          <li>Return / Refund need <b>Returns</b> above (or set order paymentStatus = Refunded).</li>
        </ul>
        <div className="mt-2"><button onClick={() => api.get('/products', { params: { limit: 1 } }).then(() => setMsg('API OK ✓')).catch((e) => setMsg(e.message))} className="text-xs border border-[#e5e2da] dark:border-[#2a3b30] rounded px-3 py-1.5 bg-white dark:bg-[#12241a]">Test API</button></div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import DateRange, { rangeParams } from '../../../components/accounting/DateRange';
import { tk, downloadCSV } from '../../../utils/accFormat';

function Row({ label, value, bold, indent, danger }) {
  return (
    <div className={`flex justify-between py-1.5 ${bold ? 'font-bold border-t border-[#e5e2da] dark:border-[#2a3b30] mt-1 pt-2.5 text-base' : 'text-sm'} ${indent ? 'pl-4' : ''}`}>
      <span className={danger ? 'text-danger' : ''}>{label}</span>
      <span className={danger ? 'text-danger' : ''}>{typeof value === 'number' ? tk(value) : value}</span>
    </div>
  );
}

export default function AccStatements() {
  const [tab, setTab] = useState('pnl');
  const [range, setRange] = useState({ preset: 'month', from: '', to: '' });
  const [pnl, setPnl] = useState(null);
  const [cf, setCf] = useState(null);
  const [tax, setTax] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = rangeParams(range);
      if (tab === 'pnl') {
        const { data } = await api.get('/accounting/profit-loss', { params });
        setPnl(data.data);
      } else if (tab === 'cf') {
        const { data } = await api.get('/accounting/cash-flow', { params });
        setCf(data.data);
      } else {
        const { data } = await api.get('/accounting/tax', { params });
        setTax(data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tab, range.preset, range.from, range.to]);

  const exportPNL = () => {
    if (!pnl) return;
    downloadCSV('profit-loss', ['Line', 'Amount'], [
      ['Product Sales', pnl.revenue?.productSales], ['Delivery Revenue', pnl.revenue?.deliveryRevenue],
      ['Other Revenue', pnl.revenue?.otherRevenue], ['(-) Returns', pnl.revenue?.returns],
      ['Total Revenue', pnl.revenue?.total], ['COGS', pnl.cost?.cogs],
      ...Object.entries(pnl.cost?.operating || {}).map(([k, v]) => [k, v]),
      ['Total Cost', pnl.cost?.total], ['Gross Profit', pnl.result?.gross],
      ['Net Profit', pnl.result?.net],
    ]);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Financial Statements</h1>
          <p className="text-sm text-gray-500 dark:text-ash">Audited — from posted journals only</p>
        </div>
        <div className="flex gap-2 items-center">
          <DateRange value={range} onChange={setRange} />
          {['pnl', 'cf', 'tax'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-xs border ${tab === t ? 'bg-gray-900 text-white dark:bg-gold-400 dark:text-[#0a0f0c] border-transparent font-medium' : 'bg-white dark:bg-[#12241a] border-[#e5e2da] dark:border-[#2a3b30]'}`}
            >
              {t === 'pnl' ? 'P&L' : t === 'cf' ? 'Cash Flow' : 'Tax/VAT'}
            </button>
          ))}
          {tab === 'pnl' && <button onClick={exportPNL} className="btn-outline text-xs">CSV</button>}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 card p-8 text-center">Loading...</p>
      ) : tab === 'pnl' && pnl ? (
        <div className="card p-6 max-w-2xl">
          <h3 className="font-bold text-lg mb-1">Profit & Loss</h3>
          <p className="text-xs text-gray-500 mb-4">Revenue</p>
          <Row label="Product Sales" value={pnl.revenue.productSales} indent />
          <Row label="Delivery Revenue" value={pnl.revenue.deliveryRevenue} indent />
          <Row label="Other Revenue" value={pnl.revenue.otherRevenue} indent />
          <Row label="(−) Returns & Refunds" value={pnl.revenue.returns} indent danger />
          <Row label="Total Revenue" value={pnl.revenue.total} bold />
          <p className="text-xs text-gray-500 mt-4 mb-1">Cost</p>
          <Row label="Cost of Goods Sold" value={pnl.cost.cogs} indent />
          {Object.entries(pnl.cost.operating || {}).filter(([, v]) => v > 0).map(([k, v]) => (
            <Row key={k} label={k.replace(/_/g, ' ')} value={v} indent />
          ))}
          <Row label="Total Cost" value={pnl.cost.total} bold />
          <Row label="Gross Profit" value={`${tk(pnl.result.gross)} (${pnl.result.grossMargin}%)`} bold />
          <Row label="Net Profit" value={`${tk(pnl.result.net)} (${pnl.result.netMargin}%)`} bold />
        </div>
      ) : tab === 'cf' && cf ? (
        <div className="card p-6 max-w-2xl">
          <h3 className="font-bold text-lg mb-4">Cash Flow</h3>
          <p className="text-xs text-gray-500 mb-1">Operating Activities</p>
          <Row label="Cash In" value={cf.operating.inflow} indent />
          <Row label="Cash Out" value={cf.operating.outflow} indent />
          <Row label="Net Operating" value={cf.operating.net} bold />
          <p className="text-xs text-gray-500 mt-4 mb-1">Investing Activities</p>
          <Row label="Cash In" value={cf.investing.inflow} indent />
          <Row label="Cash Out (purchases)" value={cf.investing.outflow} indent />
          <Row label="Net Investing" value={cf.investing.net} bold />
          <p className="text-xs text-gray-500 mt-4 mb-1">Financing Activities</p>
          <Row label="Net Financing" value={0} indent />
          <Row label="Net Cash Flow" value={cf.totals.net} bold />
          <p className="text-xs text-gray-500 mt-2">Cash In {tk(cf.totals.cashIn)} · Cash Out {tk(cf.totals.cashOut)}</p>
        </div>
      ) : tax ? (
        <div className="card p-6 max-w-2xl">
          <h3 className="font-bold text-lg mb-4">{tax.name} Report</h3>
          <Row label="Configured Rate" value={`${tax.rate}%`} />
          <Row label="Tax Collected (journals)" value={tax.collected} />
          <Row label="Adjustments" value={tax.adjusted} />
          <Row label="Tax Payable" value={tax.payable} bold />
          <Row label="Order Snapshots (info)" value={tax.orderSnapshots} />
          <p className="text-xs text-gray-500 mt-2">Orders in range: {tax.orders}. Rate is configurable in Accounting → Settings.</p>
        </div>
      ) : null}
    </div>
  );
}

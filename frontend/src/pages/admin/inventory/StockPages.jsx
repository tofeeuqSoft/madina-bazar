import { useEffect, useState, Component } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import inventoryApi from '../../../services/inventory';
import { Card, PageHead, Badge, Empty, inputCls, btnPrimary } from './widgets';

// One broken tab must never blank the whole hub.
class TabErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(prevProps) { if (prevProps.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (this.state.error) {
      return (
        <Card>
          <p className="text-sm text-red-600 font-semibold">This tab failed to load — other tabs are unaffected.</p>
          <p className="text-xs text-gray-500 mt-1">{String(this.state.error?.message || this.state.error)}</p>
          <button onClick={() => this.setState({ error: null })} className={btnPrimary}>Retry</button>
        </Card>
      );
    }
    return this.props.children;
  }
}

const STOCK_TABS = [
  { key: 'all', to: '/admin/inventory/overview', label: 'All Stock', countKey: 'all' },
  { key: 'low', to: '/admin/inventory/overview?tab=low', label: 'Low Stock', countKey: 'low' },
  { key: 'out', to: '/admin/inventory/overview?tab=out', label: 'Out of Stock', countKey: 'out' },
];

function ageOf(iso) {
  if (!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? 'just now' : `${m}m ago`;
}

function StockTabs({ active }) {
  const { pathname, search } = useLocation();
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    inventoryApi.stockCounts().then(setCounts).catch(() => {});
  }, [pathname, search]);
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {STOCK_TABS.map((t) => {
        const n = counts?.[t.countKey];
        return (
          <Link
            key={t.key}
            to={t.to}
            title={counts?.generatedAt ? `Counts as of ${ageOf(counts.generatedAt)} — snapshot, tap tab for fresh list` : t.label}
            className={active === t.key ? btnPrimary : `${btnPrimary} opacity-60`}
          >
            {t.label}{typeof n === 'number' ? ` (${n})` : ''}
          </Link>
        );
      })}
    </div>
  );
}

function StockTable({ rows }) {
  if (!rows?.length) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[1000px]">
        <thead><tr className="text-left text-gray-500"><th className="p-2">Product / SKU</th><th className="p-2">Warehouse</th><th className="p-2">On Hand</th><th className="p-2">Reserved</th><th className="p-2">Available</th><th className="p-2">Dam/Lost/Exp</th><th className="p-2">Reorder</th><th className="p-2">Avg Cost</th><th className="p-2">Value</th><th className="p-2">Status</th><th className="p-2">Store</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30]">
              <td className="p-2"><b>{r.product?.name}</b><p className="text-[10px] text-gray-400">{r.sku} {r.variantKey ? `• ${r.variantKey}` : ''}</p></td>
              <td className="p-2 text-xs">{r.warehouse?.code}</td>
              <td className="p-2">{r.onHand}</td>
              <td className="p-2">{r.reserved}</td>
              <td className="p-2 font-bold">{r.available}</td>
              <td className="p-2 text-xs">{r.damaged}/{r.lost}/{r.expired}</td>
              <td className="p-2 text-xs">{r.reorderLevel}/{r.reorderQuantity}</td>
              <td className="p-2 text-xs">৳{r.averageCost}</td>
              <td className="p-2">৳{Math.round(r.available * r.averageCost)}</td>
              <td className="p-2"><Badge value={r.status} /></td>
              <td className="p-2">{r.storeUrl ? <a href={r.storeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary-700 hover:underline"><ExternalLink className="w-3.5 h-3.5" />View</a> : <span className="text-xs text-gray-400">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useStockList(fixed = {}) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const fixedKey = JSON.stringify(fixed);
  const load = async () => {
    setLoading(true);
    try {
      const r = await inventoryApi.stock({ ...JSON.parse(fixedKey), search: search || undefined, limit: 30 });
      setRows(r.data || []);
      setTotal(r.total || 0);
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  // Refetch when tab/filter changes or page revisited — never serve stale tab data.
  useEffect(() => { setSearch(''); load(); }, [fixedKey]);
  useEffect(() => { const t = setTimeout(() => { if (search !== '') load(); }, 500); return () => clearTimeout(t); }, [search]);
  return { rows, total, search, setSearch, loading, load };
}

const TAB_STATUS = { low: 'LOW_STOCK', out: 'OUT_OF_STOCK' };
const TAB_SUB = {
  all: 'Available = OnHand − Reserved − Damaged − Lost − Expired',
  low: 'Available ≤ reorder level — restock soon',
  out: 'Available = 0 — storefront shows unavailable, backend blocks orders',
};

export function StockOverview() {
  const [params] = useSearchParams();
  const tab = params.get('tab') === 'low' ? 'low' : params.get('tab') === 'out' ? 'out' : 'all';
  const status = TAB_STATUS[tab];
  const { rows, total, search, setSearch, loading } = useStockList(status ? { status } : {});
  return (
    <div>
      <PageHead title="Stock Overview" sub={`${total} records • ${TAB_SUB[tab]}`} />
      <StockTabs active={tab} />
      <TabErrorBoundary resetKey={tab}>
        <Card className="mb-4"><input className={inputCls} style={{ maxWidth: 320 }} placeholder="Search SKU…" value={search} onChange={(e) => setSearch(e.target.value)} /></Card>
        <Card>{loading ? <Empty text="Loading…" /> : <StockTable rows={rows} />}</Card>
      </TabErrorBoundary>
    </div>
  );
}

export function Valuation() {
  const [v, setV] = useState(null);
  useEffect(() => { inventoryApi.valuation().then(setV).catch(() => {}); }, []);
  return (
    <div>
      <PageHead title="Inventory Valuation" sub="Available × average cost — NEVER selling price" />
      <Card className="mb-4"><p className="text-sm">Total inventory value: <b className="text-xl">৳{v?.totalValue ?? '…'}</b></p></Card>
      <Card>
        {(v?.rows || []).map((r) => (
          <p key={r.product._id} className="text-xs py-1.5 border-t border-black/5 flex justify-between"><span>{r.product.name} ({r.product.sku}) × {r.available}</span><b>৳{r.value}</b></p>
        ))}
      </Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import inventoryApi from '../../../services/inventory';
import api from '../../../services/api';
import { Card, PageHead } from './widgets';

const suggestMarkdownPct = (daysSinceSale) => {
  if (!daysSinceSale || daysSinceSale < 30) return 0;
  if (daysSinceSale < 60) return 5;
  if (daysSinceSale < 90) return 10;
  if (daysSinceSale < 120) return 10;
  if (daysSinceSale < 180) return 15;
  if (daysSinceSale < 365) return 20;
  return 25;
};

export default function InventoryDashboard() {
  const [d, setD] = useState(null);
  const [fc, setFc] = useState(null);
  useEffect(() => { inventoryApi.dashboard().then(setD).catch(() => {}); }, []);
  useEffect(() => { inventoryApi.forecast({ days: 30, leadTimeDays: 7, limit: 50 }).then(setFc).catch(() => setFc(null)); }, []);
  const [ds, setDs] = useState(null);
  const loadDs = () => inventoryApi.deadStock({ days: 60, limit: 10 }).then(setDs).catch(() => setDs(null));
  useEffect(() => { loadDs(); }, []);
  const markdown = async (p) => {
    if (!confirm(`${p.name} — 15% clearance markdown? Sale price will drop, reversible anytime.`)) return;
    try {
      const r = await inventoryApi.clearance({ productId: p._id, pct: 15 });
      toast.success(`${r.name}: ৳${r.oldSale} → ৳${r.newSale}`);
      loadDs();
    } catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  const draftCoupon = async (r) => {
    const sku = r.product?.sku || '';
    if (!confirm(`${r.product?.name} — create 15%-off coupon for this product only (7 days)?`)) return;
    try {
      const exp = new Date();
      exp.setDate(exp.getDate() + 7);
      const { data } = await api.post('/coupons', {
        code: `CLEAR-${sku.replace(/[^A-Z0-9]/gi, '').slice(0, 8).toUpperCase()}-15`,
        discountType: 'percentage',
        discountValue: 15,
        products: [r.product._id],
        expiryDate: exp.toISOString().slice(0, 10),
        usageLimit: Math.max(1, r.available),
        isActive: true,
      });
      toast.success(`Coupon ${data.data.code} created`);
    } catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  const urgent = (fc?.rows || []).filter((r) => r.status === 'ORDER_NOW' || r.status === 'OUT');

  const cards = [
    ['Total SKUs', d?.totalSKUs, '/admin/inventory/products'],
    ['Total Units', d?.totalUnits, '/admin/inventory/overview'],
    ['Available', d?.availableStock, '/admin/inventory/products'],
    ['Reserved', d?.reservedStock, '/admin/inventory/reservations'],
    ['Low Stock', d?.lowStock, '/admin/inventory/low-stock'],
    ['Out of Stock', d?.outOfStock, '/admin/inventory/out-of-stock'],
    ['Damaged', d?.damagedStock, '/admin/inventory/damaged'],
    ['Lost', d?.lostStock, '/admin/inventory/damaged'],
    ['Expired', d?.expiredStock, '/admin/inventory/expiry'],
    ['Expiring Soon', d?.expiringSoon, '/admin/inventory/expiry'],
    ['Inventory Value ৳', d?.inventoryValue, '/admin/inventory/valuation'],
    ['Active Alerts', d?.activeAlerts, '/admin/inventory/alerts'],
  ];

  return (
    <div>
      <PageHead title="Inventory Dashboard" sub="Live aggregation from Inventory Service — cost-based valuation, no mock data" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(([label, value, link]) => (
          <Link key={label} to={link}><Card><p className="text-xs text-gray-500 dark:text-ash">{label}</p><p className="text-2xl font-bold mt-1">{value ?? '…'}</p></Card></Link>
        ))}
      </div>
      {fc && (
        <Card className="mb-4">
          <h3 className="font-semibold text-sm mb-2">🔮 Restock forecast <span className="font-normal text-gray-500">(30d velocity • {fc.leadTimeDays}d lead time)</span></h3>
          {urgent.length === 0 ? (
            <p className="text-xs text-green-600">All stocked — nothing to order now 🎉</p>
          ) : (
            urgent.slice(0, 8).map((r) => (
              <p key={r.product?._id || r.product?.sku} className="text-xs py-1.5 border-t border-black/5 flex justify-between gap-2">
                <span><b>{r.product?.name || r.product?.sku}</b> <span className="text-gray-400">({r.product?.sku})</span> — {r.status === 'OUT' ? 'out of stock' : `${r.daysLeft}d left`}</span>
                <span className="whitespace-nowrap">order <b className="text-primary-700">{r.suggestedQty}</b></span>
              </p>
            ))
          )}
        </Card>
      )}
      {ds && ds.rows?.length > 0 && (
        <Card className="mb-4">
          <h3 className="font-semibold text-sm mb-2">💤 Dead stock <span className="font-normal text-gray-500">(no sale {ds.days}d • locked <b className="text-red-600">৳{ds.totalLocked}</b> — consider clearance)</span></h3>
          {ds.rows.slice(0, 8).map((r) => (
            <p key={r.product?._id || r.product?.sku} className="text-xs py-1.5 border-t border-black/5 flex justify-between gap-2 items-center">
              <span><b>{r.product?.name || r.product?.sku}</b> <span className="text-gray-400">({r.product?.sku})</span> — {r.daysSinceSale == null ? 'never sold' : `${r.daysSinceSale}d ago`}</span>
              <span className="whitespace-nowrap flex items-center gap-2">{r.available} pcs • ৳{r.lockedValue}
                <button onClick={() => markdown(r.product)} title="15% price markdown" className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-gold-400/15 text-gold-700 dark:text-gold-300 hover:scale-105 transition">−15%</button>
                {suggestMarkdownPct(r.daysSinceSale) > 0 && (
                  <span className="text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
                    Suggested: −{suggestMarkdownPct(r.daysSinceSale)}%
                  </span>
                )}
                <button onClick={() => draftCoupon(r)} title="15%-off coupon for this product" className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-primary-700/10 text-primary-700 dark:text-gold-300 hover:scale-105 transition">🎟</button>
              </span>
            </p>
          ))}
        </Card>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold text-sm mb-2">Today</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p>Stock in: <b>{d?.today?.stockIn ?? '…'}</b></p>
            <p>Stock out: <b>{d?.today?.stockOut ?? '…'}</b></p>
            <p>Adjustments: <b>{d?.today?.adjustments ?? '…'}</b></p>
            <p>Transfers: <b>{d?.today?.transfers ?? '…'}</b></p>
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">Warehouses</h3>
          {(d?.warehouses || []).map((w) => (
            <p key={w._id} className="text-xs py-1.5 border-t border-black/5 flex justify-between">
              <span>{w.name || w.code} ({w.code})</span>
              <span>on-hand <b>{w.stock}</b> • avail <b>{w.available}</b> • ৳{Math.round(w.value || 0)}</span>
            </p>
          )) || <p className="text-xs text-gray-500">—</p>}
        </Card>
      </div>
    </div>
  );
}

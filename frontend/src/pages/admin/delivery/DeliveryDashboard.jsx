import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import deliveryAdminApi from '../../../services/deliveryAdmin';
import { Card, PageHead } from './widgets';

export default function DeliveryDashboard() {
  const [d, setD] = useState(null);
  const [g, setG] = useState(null);
  useEffect(() => {
    deliveryAdminApi.dashboard().then(setD).catch(() => {});
    deliveryAdminApi.growth().then(setG).catch(() => {});
  }, []);

  const t = d?.totals || {};
  const n = d?.network || {};
  const f = d?.flow || {};
  const cod = d?.cod || {};
  const p = d?.performance || {};

  const cards = [
    ['Total Orders', t.totalOrders, '/admin/orders'],
    ['Own Delivery Orders', t.ownDeliveryOrders, '/admin/delivery/own'],
    ['External Courier Orders', t.externalCourierOrders, '/admin/delivery/shipments'],
    ['Active Own Zones', n.activeOwnZones, '/admin/grocery-zones'],
    ['Active Own Areas', n.activeOwnAreas, '/admin/grocery-zones'],
    ['Active Districts', n.activeDistricts, '/admin/grocery-zones'],
    ['Active Riders', n.activeRiders, '/admin/delivery/riders'],
    ['Pending Assignment', f.pendingAssignment, '/admin/delivery/pending'],
    ['Out for Delivery', f.outForDelivery, '/admin/delivery/shipments'],
    ['Delivered', f.delivered, '/admin/delivery/shipments'],
    ['Failed', f.failed, '/admin/delivery/shipments'],
    ["Today's COD ৳", cod.today, '/admin/delivery/settlement'],
  ];

  return (
    <div>
      <PageHead title="Delivery Management Dashboard" sub="Own-network expansion measured live — coverage decides routing, never area names" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(([label, value, link]) => (
          <Link key={label} to={link}><Card><p className="text-xs text-gray-500 dark:text-ash">{label}</p><p className="text-2xl font-bold mt-1">{value ?? '…'}</p></Card></Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <h3 className="font-semibold text-sm mb-2">🏁 Own Delivery Network (strategy KPI)</h3>
          <p className="text-3xl font-bold text-green-700">{n.ownCoveragePct ?? '…'}%</p>
          <p className="text-xs text-gray-500">own order share • external dependency {n.externalDependencyPct ?? '…'}%</p>
          <p className="text-xs mt-2">Success: own {p.ownSuccessRate ?? '…'}% • external {p.externalSuccessRate ?? '…'}%</p>
          <p className="text-xs">Pending COD settlement: ৳{cod.pendingSettlement ?? '…'} ({cod.pendingCount ?? 0})</p>
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">Network growth (own % by month)</h3>
          {(g?.growth || []).map((m) => (
            <div key={m.month} className="flex items-center gap-2 text-xs py-1">
              <span className="w-16">{m.month}</span>
              <div className="flex-1 h-2 rounded bg-black/10 dark:bg-white/10 overflow-hidden">
                <div className="h-full bg-green-600" style={{ width: `${m.ownPct}%` }} />
              </div>
              <b className="w-12 text-right">{m.ownPct}%</b>
            </div>
          ))}
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">Courier providers</h3>
          {(d?.providers || []).map((c) => (
            <p key={c.code} className="text-xs py-1.5 border-t border-black/5 flex justify-between"><span>{c.code} (P{c.priority})</span><b className={c.status === 'ACTIVE' ? 'text-green-600' : 'text-gray-400'}>{c.status}</b></p>
          ))}
        </Card>
      </div>
    </div>
  );
}

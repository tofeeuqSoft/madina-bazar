import { useEffect, useState } from 'react';
import orderAdminApi from '../../../services/orderAdmin';
import { Card, PageHead, Empty, btnPrimary } from './widgets';

export function OrderReports() {
  const [r, setR] = useState(null);
  useEffect(() => { orderAdminApi.reports({}).then(setR).catch(() => {}); }, []);
  return (
    <div>
      <PageHead title="Order Reports" sub="Status • payment • delivery-type breakdowns" right={<a href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/admin/orders/export`} className={btnPrimary}>Export CSV</a>} />
      <div className="grid lg:grid-cols-3 gap-4">
        {['byStatus', 'byPayment', 'byDeliveryType'].map((k) => (
          <Card key={k}><h3 className="font-semibold text-sm mb-2">{k}</h3>{((r?.[k]) || []).map((x) => <p key={x._id || 'null'} className="text-xs py-1 flex justify-between"><span>{x._id || '—'}</span><b>{x.count}{x.sales ? ` • ৳${x.sales}` : ''}</b></p>)}</Card>
        ))}
      </div>
    </div>
  );
}

export function OrderAuditPage() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { orderAdminApi.audit({}).then(setLogs).catch(() => {}); }, []);
  return (
    <div>
      <PageHead title="Order Audit Logs" sub="Immutable — ORDER_STATUS_CHANGED, ASSIGNED, CANCELLED, HOLD, notes, comms, refunds" />
      <Card>
        {logs.length === 0 ? <Empty /> : (
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-500"><th className="p-2">Time</th><th className="p-2">Order</th><th className="p-2">Action</th><th className="p-2">Actor</th><th className="p-2">Reason</th></tr></thead>
            <tbody>{logs.map((l) => <tr key={l._id} className="border-t border-black/5"><td className="p-2">{new Date(l.createdAt).toLocaleString()}</td><td className="p-2">{l.orderNumber}</td><td className="p-2">{l.action}</td><td className="p-2">{l.actor?.name} ({l.actorRole})</td><td className="p-2">{l.reason}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

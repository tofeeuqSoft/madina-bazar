import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import orderAdminApi from '../../../services/orderAdmin';
import { Card, PageHead, Empty, inputCls, btnPrimary, btnGhost } from './widgets';

export default function Assignment() {
  const [orders, setOrders] = useState([]);
  const [agents, setAgents] = useState([]);
  const [sel, setSel] = useState({});

  const load = async () => {
    const r = await orderAdminApi.list({ limit: 50 }).catch(() => ({ data: [] }));
    setOrders((r.data || []).filter((o) => !o.assignedTo));
    setAgents((await orderAdminApi.agents().catch(() => [])) || []);
  };
  useEffect(() => { load(); }, []);

  const assign = async (id, method) => {
    try {
      await orderAdminApi.assign(id, { agentId: sel[id] || undefined, method });
      toast.success('Assigned');
      load();
    } catch (e) { toast.error(e.response?.data?.message || e.message); }
  };

  return (
    <div>
      <PageHead title="Order Assignment" sub="Manual • Round-robin • Least-busy • Team-based" />
      <Card>
        {orders.length === 0 ? <Empty text="No unassigned orders 🎉" /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th className="p-2">Order</th><th className="p-2">Customer</th><th className="p-2">Amount</th><th className="p-2">Agent</th><th className="p-2">Action</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id} className="border-t border-black/5">
                  <td className="p-2"><Link className="text-primary-700 hover:underline" to={`/admin/order-mgmt/orders/${o._id}`}>{o.orderNumber}</Link></td>
                  <td className="p-2 text-xs">{o.customer?.name}</td>
                  <td className="p-2">৳{o.totalAmount}</td>
                  <td className="p-2">
                    <select className={inputCls} value={sel[o._id] || ''} onChange={(e) => setSel({ ...sel, [o._id]: e.target.value })}>
                      <option value="">Auto…</option>
                      {agents.map((a) => <option key={a._id} value={a._id}>{a.name} ({a.role})</option>)}
                    </select>
                  </td>
                  <td className="p-2"><div className="flex gap-1">
                    <button onClick={() => assign(o._id, 'MANUAL')} className={btnPrimary}>Assign</button>
                    <button onClick={() => assign(o._id, 'LEAST_BUSY')} className={btnGhost}>Least busy</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

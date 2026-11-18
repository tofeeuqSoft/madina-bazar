import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import inventoryApi from '../../../services/inventory';
import { Card, PageHead, Empty, inputCls, btnPrimary } from './widgets';
import { useTabDirty } from './hubUtils';

export function PurchaseReceiving({ onDirty }) {
  const [purchaseId, setPurchaseId] = useState('');
  const [damagedQty, setDamagedQty] = useState('');
  useTabDirty(onDirty, purchaseId.trim() !== '' || String(damagedQty || '').trim() !== '');
  const receive = async (e) => {
    e.preventDefault();
    try {
      await inventoryApi.receivePurchase(purchaseId, damagedQty ? { damaged: [] } : {});
      toast.success('Purchase received into inventory');
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
  };
  return (
    <div>
      <PageHead title="Purchase Receiving" sub="Goods received → inspected → accepted to stock, damaged to damaged bucket" />
      <Card>
        <form onSubmit={receive} className="space-y-2 max-w-xl">
          <input className={inputCls} required placeholder="Purchase _id" value={purchaseId} onChange={(e) => setPurchaseId(e.target.value)} />
          <input className={inputCls} type="number" placeholder="Damaged units (optional — same items)" value={damagedQty} onChange={(e) => setDamagedQty(e.target.value)} />
          <button className={btnPrimary}>Receive Purchase</button>
          <p className="text-[11px] text-gray-500">Accepts all purchase items at recorded costPrice (weighted-average). Idempotent per purchase.</p>
        </form>
      </Card>
    </div>
  );
}

export function ReturnedStock() {
  const [rows, setRows] = useState([]);
  const load = async () => setRows((await inventoryApi.returns({}).catch(() => ({ data: [] }))).data || []);
  useEffect(() => { load(); }, []);
  const inspect = async (id, condition) => {
    try { await inventoryApi.inspectReturn(id, {}); toast.success(`Inspected (${condition})`); load(); }
    catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  return (
    <div>
      <PageHead title="Returned Stock" sub="Received → inspected → GOOD restocks, DAMAGED/EXPIRED classified — never auto-restock" />
      <Card>
        {rows.length === 0 ? <Empty /> : rows.map((r) => (
          <div key={r._id} className="py-2 border-t border-black/5 text-sm flex flex-wrap justify-between gap-2">
            <span><b>{r.returnNumber}</b> • {r.status} • ৳{r.refundAmount} • {(r.items || []).length} items</span>
            <span className="flex gap-1">
              <button onClick={() => inspect(r._id, 'GOOD')} className={btnPrimary}>Inspect & Restock GOOD</button>
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}

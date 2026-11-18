import { useEffect, useState } from 'react';
import marketingApi from '../../../services/marketing';
import { Card, PageHead, Empty, Bars } from './widgets';

export default function Products() {
  const [d, setD] = useState(null);
  useEffect(() => { marketingApi.products({ limit: 20 }).then(setD).catch(() => {}); }, []);
  return (
    <div>
      <PageHead title="Product Performance" sub="Revenue + margin (cost-aware) — push winners, fix slow stock" />
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <h3 className="font-semibold text-sm mb-3">Top products by revenue</h3>
          <Bars rows={(d?.top || []).slice(0, 12).map((t) => ({ label: t.name?.slice(0, 18), value: t.revenue }))} money />
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-3">Category share</h3>
          <Bars rows={(d?.categories || []).map((c) => ({ label: c.category?.slice(0, 18), value: c.revenue }))} money />
        </Card>
      </div>
      <Card>
        <h3 className="font-semibold text-sm mb-2">💸 Slow movers — cash stuck on shelves (discount/campaign candidates)</h3>
        {(d?.slow || []).length === 0 ? <Empty text="No dead stock — healthy catalog" /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th className="p-2">Product</th><th className="p-2">Stock</th><th className="p-2">Tied cash</th></tr></thead>
            <tbody>
              {(d?.slow || []).map((p) => (
                <tr key={p._id} className="border-t border-black/5"><td className="p-2">{p.name}</td><td className="p-2">{p.stock}</td><td className="p-2 font-bold">৳{p.tiedCash}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

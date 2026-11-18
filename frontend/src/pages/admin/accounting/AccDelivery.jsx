import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import DateRange, { rangeParams } from '../../../components/accounting/DateRange';
import { tk } from '../../../utils/accFormat';

export default function AccDelivery() {
  const [range, setRange] = useState({ preset: 'month', from: '', to: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/accounting/delivery', { params: rangeParams(range) });
      setData(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [range.preset, range.from, range.to]);

  const cards = [
    ['Orders', data?.orders ?? '…'],
    ['Delivery Revenue', tk(data?.revenue)],
    ['Audited Revenue', tk(data?.journalRevenue)],
    ['Delivery Expense', tk(data?.expense)],
    ['Margin', `${tk(data?.margin)} (${data?.marginPct || 0}%)`],
    ['Free Deliveries', data?.freeCount ?? '…'],
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Delivery Accounting</h1>
          <p className="text-sm text-gray-500 dark:text-ash">Revenue vs cost vs margin (charges from Delivery Management — never duplicated)</p>
        </div>
        <DateRange value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-gray-500 dark:text-ash">{label}</p>
            <p className="text-lg font-bold mt-1">{loading ? '…' : value}</p>
          </div>
        ))}
      </div>

      <div className="card p-4 mt-4 text-sm text-gray-600 dark:text-gray-300">
        Customer charge (৳{tk(data?.revenue).replace('৳', '') || 0}) − actual cost (৳{data?.expense || 0}) = margin.
        Free deliveries ({data?.freeCount || 0}) carry ৳0 revenue. Journal revenue is the audited cross-check.
      </div>
    </div>
  );
}

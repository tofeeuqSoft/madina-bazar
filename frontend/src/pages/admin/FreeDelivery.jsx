import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function FreeDelivery() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ isActive: false, minimumOrderAmount: 1000, applicableTo: 'ALL' });
  const [shipment, setShipment] = useState({ mode: 'SINGLE_SHIPMENT' });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/delivery/free-delivery/admin');
      if (data.data?.rule) {
        setForm({
          isActive: !!data.data.rule.isActive,
          minimumOrderAmount: data.data.rule.minimumOrderAmount ?? 1000,
          applicableTo: data.data.rule.applicableTo || 'ALL',
        });
      }
      if (data.data?.shipment) setShipment(data.data.shipment);
    } catch {
      toast.error('Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/delivery/free-delivery', {
        isActive: form.isActive,
        minimumOrderAmount: Number(form.minimumOrderAmount) || 0,
        applicableTo: form.applicableTo,
      });
      toast.success('Saved ✓');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Free Delivery</h1>
      <p className="text-sm text-gray-500 dark:text-ash mb-4">Coupon alada — eta sudhu delivery charge niye.</p>

      <form onSubmit={save} className="card p-6 space-y-4 mb-6">
        <label className="flex items-center justify-between gap-3">
          <span className="font-medium">Status: {form.isActive ? 'ON' : 'OFF'}</span>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
            className={`w-12 h-6 rounded-full transition relative ${form.isActive ? 'bg-success' : 'bg-gray-300 dark:bg-white/20'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.isActive ? 'left-6' : 'left-0.5'}`} />
          </button>
        </label>

        <div>
          <label className="block text-sm font-medium mb-1">Minimum Order Amount (৳)</label>
          <input
            type="number" min="0" className="input w-40"
            value={form.minimumOrderAmount}
            onChange={(e) => setForm({ ...f, minimumOrderAmount: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Applicable To</label>
          <div className="flex gap-2">
            {[
              { v: 'ALL', label: 'All Products' },
              { v: 'GROCERY', label: 'Grocery' },
              { v: 'NATIONWIDE', label: 'Nationwide' },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setForm((f) => ({ ...f, applicableTo: o.v }))}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                  form.applicableTo === o.v
                    ? 'bg-[#0e4430] text-white dark:bg-gold-400 dark:text-[#0a0f0c] border-transparent'
                    : 'border-[#e5e2da] dark:border-[#2a3b30]'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save Rule'}
        </button>
      </form>

      <div className="card p-6">
        <h2 className="font-semibold mb-2">Shipment Rule</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Mode: <b>{shipment.mode || 'SINGLE_SHIPMENT'}</b> — mixed cart-e <b>MAX(grocery, nationwide)</b> charge hobe. Free eligible hole ৳0.
        </p>
      </div>
    </div>
  );
}

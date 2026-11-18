import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: '',
    minimumOrderAmount: 0,
    maximumDiscount: '',
    expiryDate: '',
    startDate: '',
    productSkus: '',
    usageLimit: '',
    maxPerUser: '',
    isActive: true,
  });

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/coupons');
      setCoupons(data.data || []);
    } catch (err) {
      toast.error('Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      code: '',
      discountType: 'percentage',
      discountValue: '',
      minimumOrderAmount: 0,
      maximumDiscount: '',
      expiryDate: '',
      startDate: '',
      productSkus: '',
      usageLimit: '',
    maxPerUser: '',
      isActive: true,
    });
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      code: c.code || '',
      discountType: c.discountType || 'percentage',
      discountValue: c.discountValue ?? '',
      minimumOrderAmount: c.minimumOrderAmount ?? 0,
      maximumDiscount: c.maximumDiscount ?? '',
      expiryDate: c.expiryDate ? c.expiryDate.slice(0, 10) : '',
      startDate: c.startDate ? c.startDate.slice(0, 10) : '',
      productSkus: '',
      usageLimit: c.usageLimit ?? '',
      maxPerUser: c.maxPerUser ?? '',
      isActive: c.isActive !== false,
    });
    setShowForm(true);
  };

  // SKU list → product _ids (empty = whole cart)
  const resolveSkus = async (csv) => {
    const skus = String(csv || '').split(',').map((s) => s.trim()).filter(Boolean);
    const ids = [];
    for (const sku of skus) {
      try {
        const { data } = await api.get('/admin/inventory/catalog', { params: { search: sku, limit: 3 } });
        const hit = (data.data || []).find((p) => (p.sku || '').toUpperCase() === sku.toUpperCase()) || (data.data || [])[0];
        if (hit) ids.push(hit._id);
        else toast.error(`SKU not found: ${sku}`);
      } catch { toast.error(`Lookup failed: ${sku}`); }
    }
    return ids;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || form.discountValue === '') {
      toast.error('Code and discount value are required');
      return;
    }

    try {
      const products = editing && !form.productSkus.trim() ? undefined : await resolveSkus(form.productSkus);
      const payload = {
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minimumOrderAmount: Number(form.minimumOrderAmount) || 0,
        maximumDiscount: form.maximumDiscount !== '' ? Number(form.maximumDiscount) : undefined,
        expiryDate: form.expiryDate || undefined,
        startDate: form.startDate || undefined,
        ...(products !== undefined ? { products } : {}),
        usageLimit: form.usageLimit !== '' ? Number(form.usageLimit) : undefined,
        maxPerUser: form.maxPerUser !== '' ? Number(form.maxPerUser) : null,
        isActive: form.isActive,
      };

      if (editing) {
        await api.put(`/coupons/${editing._id}`, payload);
        toast.success('Coupon updated');
      } else {
        await api.post('/coupons', payload);
        toast.success('Coupon created');
      }
      setShowForm(false);
      loadCoupons();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  const toggleStatus = async (id) => {
    try {
      await api.patch(`/coupons/${id}/status`);
      toast.success('Status updated');
      loadCoupons();
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const deleteCoupon = async (id, code) => {
    if (!confirm(`Delete coupon "${code}"?`)) return;
    try {
      await api.delete(`/coupons/${id}`);
      toast.success('Coupon deleted');
      loadCoupons();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const formatDiscount = (c) => {
    if (c.discountType === 'percentage') {
      return `${c.discountValue}%${c.maximumDiscount ? ` (max ৳${c.maximumDiscount})` : ''}`;
    }
    return `৳${c.discountValue}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Coupons</h1>
          <p className="text-sm text-gray-500 dark:text-ash">Discount codes for customers</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm">
          <Plus className="w-4 h-4 mr-1" />
          Add Coupon
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12241a] dark:border dark:border-[#2a3b30] rounded-xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editing ? 'Edit Coupon' : 'Add Coupon'}
              </h2>
              <button onClick={() => setShowForm(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Code *</label>
                <input
                  className="input uppercase"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="WELCOME10"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Type *</label>
                  <select
                    className="input"
                    value={form.discountType}
                    onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (৳)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Value *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input"
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Min Order (৳)</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={form.minimumOrderAmount}
                    onChange={(e) => setForm({ ...form, minimumOrderAmount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Discount (৳)</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={form.maximumDiscount}
                    onChange={(e) => setForm({ ...form, maximumDiscount: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Products (SKU, comma — empty = whole cart)</label>
                <input
                  className="input font-mono"
                  value={form.productSkus}
                  onChange={(e) => setForm({ ...form, productSkus: e.target.value })}
                  placeholder="e.g. GI-01, RICE-5KG"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    className="input"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Expiry Date</label>
                  <input
                    type="date"
                    className="input"
                    value={form.expiryDate}
                    onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Usage Limit</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={form.usageLimit}
                    onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Per User</label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={form.maxPerUser}
                    onChange={(e) => setForm({ ...form, maxPerUser: e.target.value })}
                    placeholder="Unlimited"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded"
                />
                Active
              </label>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {editing ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline flex-1">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#12241a] rounded-xl shadow-sm border border-[#e5e2da] dark:border-[#2a3b30] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f5f0] dark:bg-white/5">
              <tr>
                <th className="text-left p-4 font-medium">Code</th>
                <th className="text-left p-4 font-medium">Discount</th>
                <th className="text-left p-4 font-medium">Scope</th>
                <th className="text-left p-4 font-medium">Min Order</th>
              <th className="text-left p-4 font-medium">Used</th>
              <th className="text-left p-4 font-medium">Expiry</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500 dark:text-ash">Loading...</td>
              </tr>
            ) : coupons.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500 dark:text-ash">
                  No coupons yet. Create one like WELCOME10
                </td>
              </tr>
            ) : (
              coupons.map((c) => (
                <tr key={c._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30] hover:bg-[#f7f5f0] dark:hover:bg-white/5">
                  <td className="p-4 font-mono font-medium">{c.code}</td>
                  <td className="p-4">{formatDiscount(c)}</td>
                  <td className="p-4 text-xs text-gray-500">{(c.products || []).length ? `${c.products.length} product(s)` : 'Whole cart'}</td>
                  <td className="p-4">৳{c.minimumOrderAmount || 0}</td>
                  <td className="p-4">
                    {c.usedCount || 0}
                    {c.usageLimit ? ` / ${c.usageLimit}` : ''}
                  </td>
                  <td className="p-4 text-gray-600 dark:text-ash">
                    {c.expiryDate
                      ? new Date(c.expiryDate).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleStatus(c._id)}
                      className={`text-xs px-2 py-1 rounded-full ${
                        c.isActive
                          ? 'bg-success/15 text-success'
                          : 'bg-black/5 text-smoke dark:bg-white/10 dark:text-ash'
                      }`}
                    >
                      {c.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded">
                        <Edit className="w-4 h-4 text-gray-600 dark:text-ash" />
                      </button>
                      <button
                        onClick={() => deleteCoupon(c._id, c.code)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-danger/20 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}



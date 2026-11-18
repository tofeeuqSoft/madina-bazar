import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function AdminCombos() {
  const [combos, setCombos] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    name: '',
    regularPrice: '',
    salePrice: '',
    discount: 0,
    description: '',
    images: '',
    isActive: true,
    isFeatured: false,
    items: [{ product: '', quantity: 1 }],
  });

  useEffect(() => {
    loadCombos();
    loadProducts();
  }, []);

  const loadCombos = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/combos');
      setCombos(data.data || []);
    } catch (err) {
      toast.error('Failed to load combos');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const { data } = await api.get('/products', { params: { limit: 200, isActive: true, scope: 'all' } });
      setProducts(data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      regularPrice: '',
      salePrice: '',
      discount: 0,
      description: '',
      images: '',
      isActive: true,
      isFeatured: false,
      items: [{ product: '', quantity: 1 }],
    });
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name || '',
      regularPrice: c.regularPrice ?? '',
      salePrice: c.salePrice ?? '',
      discount: c.discount ?? 0,
      description: c.description || '',
      images: Array.isArray(c.images)
        ? c.images.map((img) => (typeof img === 'string' ? img : img.url)).join('\n')
        : '',
      isActive: c.isActive !== false,
      isFeatured: c.isFeatured || false,
      items: c.items?.length
        ? c.items.map((i) => ({
            product: i.product?._id || i.product || '',
            quantity: i.quantity || 1,
          }))
        : [{ product: '', quantity: 1 }],
    });
    setShowForm(true);
  };

  const updateItem = (index, field, value) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    setForm({ ...form, items });
  };

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { product: '', quantity: 1 }] });
  };

  const removeItem = (index) => {
    if (form.items.length <= 1) return;
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.regularPrice === '') {
      toast.error('Name and regular price are required');
      return;
    }
    const validItems = form.items.filter((i) => i.product && i.quantity >= 1);
    if (validItems.length === 0) {
      toast.error('Add at least one product');
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        regularPrice: Number(form.regularPrice),
        salePrice: form.salePrice !== '' ? Number(form.salePrice) : Number(form.regularPrice),
        discount: Number(form.discount) || 0,
        description: form.description,
        images: form.images
          ? form.images.split('\n').map((s) => s.trim()).filter(Boolean)
          : [],
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        items: validItems.map((i) => ({
          product: i.product,
          quantity: Number(i.quantity),
        })),
      };

      if (editing) {
        await api.put(`/combos/${editing._id}`, payload);
        toast.success('Combo updated');
      } else {
        await api.post('/combos', payload);
        toast.success('Combo created');
      }
      setShowForm(false);
      loadCombos();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  const toggleStatus = async (id) => {
    try {
      await api.patch(`/combos/${id}/status`);
      toast.success('Status updated');
      loadCombos();
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const deleteCombo = async (id, name) => {
    if (!confirm(`Delete combo "${name}"?`)) return;
    try {
      await api.delete(`/combos/${id}`);
      toast.success('Combo deleted');
      loadCombos();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Combo Packs</h1>
          <p className="text-sm text-gray-500 dark:text-ash">Bundle products with special prices</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm">
          <Plus className="w-4 h-4 mr-1" />
          Add Combo
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12241a] dark:border dark:border-[#2a3b30] rounded-xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editing ? 'Edit Combo' : 'Add Combo Pack'}
              </h2>
              <button onClick={() => setShowForm(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Combo Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Products *</label>
                {form.items.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <select
                      className="input flex-1 text-sm"
                      value={item.product}
                      onChange={(e) => updateItem(i, 'product', e.target.value)}
                    >
                      <option value="">Select product</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} — ৳{p.salePrice || p.regularPrice}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      className="input w-20 text-sm"
                      value={item.quantity}
                      onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-danger/20 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addItem} className="text-sm text-primary-600 dark:text-gold-300 hover:underline">
                  + Add product
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Regular Price *</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={form.regularPrice}
                    onChange={(e) => setForm({ ...form, regularPrice: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Sale Price</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={form.salePrice}
                    onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Image URLs (one per line)</label>
                <textarea
                  className="input font-mono text-sm"
                  rows={2}
                  value={form.images}
                  onChange={(e) => setForm({ ...form, images: e.target.value })}
                />
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="rounded"
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                    className="rounded"
                  />
                  Featured
                </label>
              </div>

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
              <th className="text-left p-4 font-medium">Combo</th>
              <th className="text-left p-4 font-medium">Items</th>
              <th className="text-left p-4 font-medium">Price</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-ash">Loading...</td>
              </tr>
            ) : combos.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-ash">
                  No combos yet. Create a family grocery pack!
                </td>
              </tr>
            ) : (
              combos.map((c) => (
                <tr key={c._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30] hover:bg-[#f7f5f0] dark:hover:bg-white/5">
                  <td className="p-4">
                    <div className="font-medium">{c.name}</div>
                    {c.isFeatured && (
                      <span className="text-xs text-orange-600">Featured</span>
                    )}
                  </td>
                  <td className="p-4 text-gray-600 dark:text-ash">
                    {c.items?.length || 0} product(s)
                  </td>
                  <td className="p-4">
                    <span className="font-medium">৳{c.salePrice || c.regularPrice}</span>
                    {c.salePrice && c.salePrice < c.regularPrice && (
                      <span className="text-xs text-gray-400 dark:text-ash line-through ml-1">
                        ৳{c.regularPrice}
                      </span>
                    )}
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
                        onClick={() => deleteCombo(c._id, c.name)}
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

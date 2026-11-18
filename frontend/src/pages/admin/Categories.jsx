import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, ChevronRight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { uploadImage } from '../../services/uploadService';

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [parentOptions, setParentOptions] = useState([]);

  const [form, setForm] = useState({
    name: '',
    parentCategory: '',
    description: '',
    displayOrder: 0,
    leadTimeDays: '',
    isActive: true,
    image: '',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/categories/tree');
      setCategories(data.data || []);
      // Flat list for parent select
      const { data: flat } = await api.get('/categories');
      setParentOptions(flat.data || []);
    } catch (err) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = (parentId = '') => {
    setEditing(null);
    setForm({
      name: '',
      parentCategory: parentId,
      description: '',
      displayOrder: 0,
      leadTimeDays: '',
      isActive: true,
      image: '',
    });
    setShowForm(true);
  };

  const openEdit = (cat) => {
    setEditing(cat);
    setForm({
      name: cat.name || '',
      parentCategory: cat.parentCategory?._id || cat.parentCategory || '',
      description: cat.description || '',
      displayOrder: cat.displayOrder || 0,
      leadTimeDays: cat.leadTimeDays ?? '',
      isActive: cat.isActive !== false,
      image: cat.image || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        parentCategory: form.parentCategory || null,
        description: form.description,
        displayOrder: Number(form.displayOrder) || 0,
        leadTimeDays: form.leadTimeDays === '' ? null : Number(form.leadTimeDays),
        isActive: form.isActive,
        image: form.image,
      };

      if (editing) {
        await api.put(`/categories/${editing._id}`, payload);
        toast.success('Category updated');
      } else {
        await api.post('/categories', payload);
        toast.success('Category created');
      }
      setShowForm(false);
      loadCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  const toggleStatus = async (id) => {
    try {
      await api.patch(`/categories/${id}/status`);
      toast.success('Status updated');
      loadCategories();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const deleteCategory = async (id, name) => {
    if (!confirm(`Delete category "${name}"?`)) return;
    try {
      await api.delete(`/categories/${id}`);
      toast.success('Category deleted');
      loadCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const CategoryRow = ({ cat, depth = 0 }) => (
    <>
      <tr className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30] hover:bg-[#f7f5f0] dark:hover:bg-white/5">
        <td className="p-3">
          <div className="flex items-center gap-2" style={{ paddingLeft: depth * 20 }}>
            {depth > 0 && <ChevronRight className="w-3 h-3 text-gray-400 dark:text-ash" />}
            <span className="font-medium">{cat.name}</span>
            <span className="text-xs text-gray-400 dark:text-ash">/{cat.slug}</span>
            {cat.type && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-700/10 text-primary-700 dark:text-gold-300 dark:bg-gold-400/10 font-medium">
                {cat.type.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </td>
        <td className="p-3 text-sm text-gray-500 dark:text-ash">{cat.displayOrder}</td>
        <td className="p-3">
          <button
            onClick={() => toggleStatus(cat._id)}
            className={`text-xs px-2 py-1 rounded-full ${
              cat.isActive ? 'bg-success/15 text-success' : 'bg-black/5 text-smoke dark:bg-white/10 dark:text-ash'
            }`}
          >
            {cat.isActive ? 'Active' : 'Inactive'}
          </button>
        </td>
        <td className="p-3">
          <div className="flex gap-1">
            <button
              onClick={() => openCreate(cat._id)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded text-xs text-primary-600 dark:text-gold-300"
              title="Add subcategory"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => openEdit(cat)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded">
              <Edit className="w-4 h-4 text-gray-600 dark:text-ash" />
            </button>
            <button
              onClick={() => deleteCategory(cat._id, cat.name)}
              className="p-1.5 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </td>
      </tr>
      {cat.children?.map((child) => (
        <CategoryRow key={child._id} cat={child} depth={depth + 1} />
      ))}
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Categories</h1>
        <button onClick={() => openCreate()} className="btn-primary text-sm">
          <Plus className="w-4 h-4 mr-1" />
          Add Category
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12241a] dark:border dark:border-[#2a3b30] rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editing ? 'Edit Category' : 'Add Category'}
              </h2>
              <button onClick={() => setShowForm(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Parent Category</label>
                <select
                  className="input"
                  value={form.parentCategory}
                  onChange={(e) => {
                    const pid = e.target.value;
                    const parent = parentOptions.find((c) => c._id === pid);
                    setForm((f) => ({ ...f, parentCategory: pid }));
                  }}
                >
                  <option value="">None (Root)</option>
                  {parentOptions
                    .filter((c) => !editing || c._id !== editing._id)
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                {(() => {
                  const parent = parentOptions.find((c) => c._id === form.parentCategory);
                  if (!parent) return null;
                  return (
                    <p className="text-[11px] text-gray-500 mt-1">
                      Type auto-hobe: <b>{String(parent.type || 'parent tree').replace(/_/g, ' ')}</b>
                    </p>
                  );
                })()}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Display Order</label>
                <input
                  type="number"
                  className="input"
                  value={form.displayOrder}
                  onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Buyer lead time (days, empty = default 7)</label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  className="input"
                  value={form.leadTimeDays}
                  onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })}
                  placeholder="e.g. 14 for imports"
                />
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
                <label className="block text-sm font-medium mb-1">Image</label>
                <div className="flex gap-2 mb-2">
                  <input
                    className="input flex-1"
                    value={form.image}
                    onChange={(e) => setForm({ ...form, image: e.target.value })}
                    placeholder="Image URL or upload"
                  />
                  <label className="btn-outline text-sm cursor-pointer whitespace-nowrap">
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const result = await uploadImage(file);
                          setForm((f) => ({ ...f, image: result.url }));
                          toast.success('Image uploaded');
                        } catch (err) {
                          toast.error(err.response?.data?.message || 'Upload failed');
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                {form.image && (
                  <img src={form.image} alt="" className="w-20 h-20 object-cover rounded border" />
                )}
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
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-outline flex-1"
                >
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
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Order</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500 dark:text-ash">Loading...</td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500 dark:text-ash">
                  No categories. Add one to get started.
                </td>
              </tr>
            ) : (
              categories.map((cat) => <CategoryRow key={cat._id} cat={cat} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

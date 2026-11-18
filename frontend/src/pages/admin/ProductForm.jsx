import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import MediaUploader from '../../components/admin/MediaUploader';
import { PRESET_COLORS } from '../../utils/colorPalette';

const UNITS = ['Piece', 'KG', 'Gram', 'Liter', 'ML', 'Packet', 'Box', 'Dozen'];

export default function ProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id) && id !== 'new';
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  // Delivery scope FIRST: Nationwide (all Bangladesh) or Grocery (grocery zones only)
  const [scope, setScope] = useState('Nationwide');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  const pickScope = (next) => {
    setScope(next);
  };
  
  const [form, setForm] = useState({
    name: '',
    category: '',
    subcategory: '',
    brand: '',
    sku: '',
    regularPrice: '',
    salePrice: '',
    schedPrice: '',
    schedStart: '',
    schedEnd: '',
    costPrice: '',
    sizes: '',
    colors: [],
    stock: 0,
    minStock: 5,
    vatExempt: false,
    unit: 'Piece',
    description: '',
    images: [],
    videos: [],
    isActive: true,
    isFeatured: false,
  });

  useEffect(() => {
    loadCategories();
    if (isEdit) loadProduct();
  }, [id]);

  useEffect(() => {
    if (form.category) {
      loadSubcategories(form.category);
    } else {
      setSubcategories([]);
    }
  }, [form.category]);

  const loadCategories = async () => {
    try {
      const { data } = await api.get('/categories', { params: { parent: 'null' } });
      setCategories(data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSubcategories = async (parentId) => {
    try {
      const { data } = await api.get('/categories', { params: { parent: parentId } });
      setSubcategories(data.data || []);
    } catch (err) {
      setSubcategories([]);
    }
  };

  const loadProduct = async () => {
    setFetching(true);
    try {
      const { data } = await api.get(`/products/${id}`);
      const p = data.data;
      setScope(p.isGrocery ? 'Grocery' : 'Nationwide');
      setForm({
        name: p.name || '',
        category: p.category?._id || p.category || '',
        subcategory: p.subcategory?._id || p.subcategory || '',
        brand: p.brand || '',
        sku: p.sku || '',
        regularPrice: p.regularPrice ?? '',
        salePrice: p.salePrice ?? '',
        schedPrice: p.saleSchedule?.price ?? '',
        schedStart: p.saleSchedule?.startDate ? p.saleSchedule.startDate.slice(0, 16) : '',
        schedEnd: p.saleSchedule?.endDate ? p.saleSchedule.endDate.slice(0, 16) : '',
        costPrice: p.costPrice ?? '',
        sizes: Array.isArray(p.sizes) ? p.sizes.join(', ') : '',
        colors: Array.isArray(p.colors) ? p.colors.map((c) => (typeof c === 'string' ? { name: c, code: '' } : { name: c.name || '', code: c.code || '' })) : [],
        stock: p.stock ?? 0,
        minStock: p.minStock ?? 5,
        vatExempt: p.vatExempt || false,
        unit: p.unit || 'Piece',
        description: p.description || '',
        images: Array.isArray(p.images)
          ? p.images.map((img) => (typeof img === 'string' ? img : img.url)).filter(Boolean)
          : [],
        videos: Array.isArray(p.videos)
          ? p.videos.map((v) => (typeof v === 'string' ? { url: v } : v)).filter((v) => v?.url)
          : [],
        isActive: p.isActive !== false,
        isFeatured: p.isFeatured || false,
      });
    } catch (err) {
      toast.error('Product not found');
      navigate('/admin/products');
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.category || form.regularPrice === '') {
      toast.error('Name, category and regular price are required');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name,
        category: form.category,
        subcategory: form.subcategory || null,
        isGrocery: scope === 'Grocery',
        brand: form.brand,
        sku: form.sku || undefined,
        regularPrice: Number(form.regularPrice),
        salePrice: form.salePrice !== '' ? Number(form.salePrice) : Number(form.regularPrice),
        costPrice: form.costPrice !== '' ? Number(form.costPrice) : 0,
        sizes: form.sizes,
        colors: (form.colors || []).filter((c) => c.name?.trim()),
        stock: Number(form.stock) || 0,
        minStock: Number(form.minStock) || 5,
        vatExempt: !!form.vatExempt,
        unit: form.unit,
        description: form.description,
        images: (form.images || []).map((url) =>
          typeof url === 'string' ? { url, isMain: false } : url
        ),
        videos: form.videos || [],
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        saleSchedule: form.schedPrice !== '' && form.schedStart && form.schedEnd
          ? { price: Number(form.schedPrice), startDate: form.schedStart, endDate: form.schedEnd }
          : form.schedPrice === '' && !form.schedStart && !form.schedEnd
            ? { price: null, startDate: null, endDate: null }
            : undefined,
      };

      if (isEdit) {
        await api.put(`/products/${id}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/products', payload);
        toast.success('Product created');
      }
      navigate('/admin/products');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="animate-pulse space-y-4 max-w-2xl">
        <div className="h-8 bg-gray-200 dark:bg-white/10 rounded w-1/3" />
        <div className="h-64 bg-gray-200 dark:bg-white/10 rounded" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Link
        to="/admin/products"
        className="inline-flex items-center text-sm text-gray-600 dark:text-ash hover:text-primary-600 dark:hover:text-gold-300 mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Products
      </Link>

      <h1 className="text-2xl font-bold mb-6">
        {isEdit ? 'Edit Product' : 'Add Product'}
      </h1>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#12241a] rounded-xl border border-[#e5e2da] dark:border-[#2a3b30] shadow-sm p-6 space-y-5">
        {/* Step 1 — Delivery scope */}
        <div>
          <label className="block text-sm font-medium mb-2">Delivery Scope * (first select this)</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { v: 'Nationwide', icon: '🌍', desc: 'All Bangladesh delivery' },
              { v: 'Grocery', icon: '🥛', desc: 'Grocery zones only (Mirpur+)' },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => pickScope(o.v)}
                className={`rounded-xl border-2 p-3 text-left transition ${
                  scope === o.v
                    ? 'border-primary-700 dark:border-gold-400 bg-primary-50 dark:bg-gold-400/10'
                    : 'border-[#e5e2da] dark:border-[#2a3b30] hover:border-primary-400'
                }`}
              >
                <span className="text-xl">{o.icon}</span>
                <span className="block font-semibold text-sm mt-1">{o.v}</span>
                <span className="block text-[11px] text-gray-500">{o.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Product Name *</label>
          <input
            name="name"
            className="input"
            value={form.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category *</label>
            <select
              name="category"
              className="input"
              value={form.category}
              onChange={handleChange}
              required
            >
              <option value="">Select Category</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Subcategory</label>
            <select
              name="subcategory"
              className="input"
              value={form.subcategory}
              onChange={handleChange}
            >
              <option value="">None</option>
              {subcategories.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Unit</label>
            <select name="unit" className="input" value={form.unit} onChange={handleChange}>
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Brand</label>
            <input name="brand" className="input" value={form.brand} onChange={handleChange} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">SKU</label>
            <input name="sku" className="input" value={form.sku} onChange={handleChange} placeholder="Auto if empty" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Regular Price (৳) *</label>
            <input
              name="regularPrice"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.regularPrice}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sale Price (৳)</label>
            <input
              name="salePrice"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.salePrice}
              onChange={handleChange}
            />
          </div>
          <div className="sm:col-span-2 border rounded-xl p-3">
            <label className="block text-sm font-medium mb-1">⚡ Flash sale schedule <span className="font-normal text-gray-500">(optional — auto on/off hourly)</span></label>
            <div className="grid sm:grid-cols-3 gap-3">
              <input
                name="schedPrice"
                type="number"
                min="0"
                step="0.01"
                className="input"
                placeholder="Sale price ৳"
                value={form.schedPrice}
                onChange={handleChange}
              />
              <input
                name="schedStart"
                type="datetime-local"
                className="input"
                value={form.schedStart}
                onChange={handleChange}
              />
              <input
                name="schedEnd"
                type="datetime-local"
                className="input"
                value={form.schedEnd}
                onChange={handleChange}
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">All three set = scheduled • all empty = cleared • manual price edits mid-window revert next sweep.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cost Price (৳) — for COGS/profit</label>
            <input
              name="costPrice"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.costPrice}
              onChange={handleChange}
              placeholder="Purchase cost"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Stock</label>
            <input
              name="stock"
              type="number"
              min="0"
              className="input"
              value={form.stock}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Min Stock (Alert)</label>
            <input
              name="minStock"
              type="number"
              min="0"
              className="input"
              value={form.minStock}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="border rounded-xl p-4 space-y-4">
          <div>
            <h3 className="font-semibold">Variants (optional)</h3>
            <p className="text-xs text-gray-500">Grocery items usually skip this. For clothing etc. add available sizes & colors.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Available Sizes (comma separated)</label>
            <input
              name="sizes"
              className="input"
              value={form.sizes}
              onChange={handleChange}
              placeholder="e.g. S, M, L, XL"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Available Colors</label>
            <p className="text-xs text-gray-500 mb-2">Palette theke click kore quick add, or niche custom:</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {PRESET_COLORS.map((preset) => {
                const added = (form.colors || []).some(
                  (c) => c.name?.toLowerCase() === preset.name.toLowerCase()
                );
                return (
                  <button
                    key={preset.name}
                    type="button"
                    title={added ? `${preset.name} (added)` : `Add ${preset.name}`}
                    onClick={() => {
                      if (added) return;
                      setForm((f) => ({ ...f, colors: [...(f.colors || []), { ...preset }] }));
                    }}
                    className={`w-8 h-8 rounded-full border-2 transition ${
                      added
                        ? 'border-green-600 opacity-40 cursor-default'
                        : 'border-gray-300 hover:scale-110'
                    }`}
                    style={{ backgroundColor: preset.code }}
                  />
                );
              })}
            </div>
            <div className="space-y-2">
              {(form.colors || []).map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    className="input flex-1"
                    placeholder="Color name (e.g. Red)"
                    value={c.name}
                    onChange={(e) => {
                      const colors = [...form.colors];
                      colors[i] = { ...colors[i], name: e.target.value };
                      setForm((f) => ({ ...f, colors }));
                    }}
                  />
                  <input
                    type="color"
                    className="w-10 h-10 rounded border cursor-pointer bg-white"
                    value={/^#[0-9a-fA-F]{6}$/.test(c.code) ? c.code : '#d9a857'}
                    onChange={(e) => {
                      const colors = [...form.colors];
                      colors[i] = { ...colors[i], code: e.target.value };
                      setForm((f) => ({ ...f, colors }));
                    }}
                    title="Swatch color"
                  />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, colors: f.colors.filter((_, j) => j !== i) }))}
                    className="btn-outline text-sm px-3"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, colors: [...(f.colors || []), { name: '', code: '#d9a857' }] }))}
                className="btn-outline text-sm"
              >
                + Add Color
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            name="description"
            className="input"
            rows={3}
            value={form.description}
            onChange={handleChange}
          />
        </div>

                <MediaUploader
          images={form.images}
          videos={form.videos}
          onImagesChange={(images) => setForm((f) => ({ ...f, images }))}
          onVideosChange={(videos) => setForm((f) => ({ ...f, videos }))}
        />

        <div>
          <label className="block text-sm font-medium mb-1">Or paste image URLs (one per line)</label>
          <textarea
            className="input font-mono text-sm"
            rows={2}
            value={(form.images || []).join('\n')}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                images: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
              }))
            }
            placeholder="https://..."
          />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              checked={form.isActive}
              onChange={handleChange}
              className="rounded"
            />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isFeatured"
              checked={form.isFeatured}
              onChange={handleChange}
              className="rounded"
            />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm" title="VAT-মুক্ত পণ্য (যেমন কাঁচা কৃষিপণ্য) — VAT হিসাবে বাদ যাবে">
            <input
              type="checkbox"
              name="vatExempt"
              checked={form.vatExempt}
              onChange={handleChange}
              className="rounded"
            />
            VAT Exempt
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
          </button>
          <Link to="/admin/products" className="btn-outline">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

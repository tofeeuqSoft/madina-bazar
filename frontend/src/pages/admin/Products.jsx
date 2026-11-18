import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function AdminProducts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const page = Number(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';

  useEffect(() => {
    loadProducts();
  }, [page, search]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20, isActive: 'all' };
      if (search) params.search = search;
      const { data } = await api.get('/products', { params });
      setProducts(data.data || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id) => {
    try {
      await api.patch(`/products/${id}/status`);
      toast.success('Status updated');
      loadProducts();
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  // NOTE: Product delete is disabled (backend returns 403) — created products
  // must stay for orders/stock/reports accuracy. Use Active/Inactive instead.

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Products ({total})</h1>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search products..."
            className="input text-sm w-48"
            defaultValue={search}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const p = new URLSearchParams(searchParams);
                p.set('search', e.target.value);
                p.set('page', '1');
                setSearchParams(p);
              }
            }}
          />
          <Link to="/admin/products/new" className="btn-primary text-sm">
            <Plus className="w-4 h-4 mr-1" />
            Add Product
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-[#12241a] rounded-xl shadow-sm border border-[#e5e2da] dark:border-[#2a3b30] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f5f0] dark:bg-white/5">
            <tr>
              <th className="text-left p-4 font-medium">Product</th>
              <th className="text-left p-4 font-medium">Price</th>
              <th className="text-left p-4 font-medium">Stock</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-ash">Loading...</td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-ash">No products found</td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30] hover:bg-[#f7f5f0] dark:hover:bg-white/5">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-white/10 rounded overflow-hidden flex-shrink-0">
                        {(p.images?.[0]?.url || p.images?.[0]) ? (
                          <img
                            src={p.images[0]?.url || p.images[0]}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm">🛒</div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-gray-500 dark:text-ash">{p.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium">৳{p.salePrice || p.regularPrice}</div>
                    {p.salePrice && p.salePrice < p.regularPrice && (
                      <div className="text-xs text-gray-400 dark:text-ash line-through">৳{p.regularPrice}</div>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={p.stock <= (p.minStock || 5) ? 'text-red-600 dark:text-danger font-medium' : ''}>
                      {p.stock} {p.unit}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleStatus(p._id)}
                      className={`text-xs px-2 py-1 rounded-full ${
                        p.isActive ? 'bg-success/15 text-success' : 'bg-black/5 text-smoke dark:bg-white/10 dark:text-ash'
                      }`}
                    >
                      {p.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <Link
                        to={`/admin/products/${p._id}`}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-gray-600 dark:text-ash" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => {
              const p = new URLSearchParams(searchParams);
              p.set('page', String(page - 1));
              setSearchParams(p);
            }}
            className="btn-outline text-sm"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm">Page {page} of {pages}</span>
          <button
            disabled={page >= pages}
            onClick={() => {
              const p = new URLSearchParams(searchParams);
              p.set('page', String(page + 1));
              setSearchParams(p);
            }}
            className="btn-outline text-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

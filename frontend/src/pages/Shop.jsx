import { useState, useEffect, useCallback } from 'react';
import SEO from '../components/seo/SEO';
import { useSearchParams } from 'react-router-dom';
import { Filter, X, Loader2 } from 'lucide-react';
import ProductCard from '../components/product/ProductCard';
import { getProducts } from '../services/productService';
import api from '../services/api';
import useT from '../hooks/useT';
import useInfiniteScroll from '../hooks/useInfiniteScroll';

export default function Shop() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [facets, setFacets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [searchMeta, setSearchMeta] = useState(null);
  const [error, setError] = useState(null);
  const [groceryAreas, setGroceryAreas] = useState([]);
  // Category tree for hover sub-category dropdowns (id -> children)
  const [catKids, setCatKids] = useState({});

  useEffect(() => {
    api.get('/categories/tree')
      .then(({ data }) => {
        const map = {};
        const walk = (nodes) => {
          (nodes || []).forEach((n) => {
            if (n.children?.length) {
              map[String(n._id)] = n.children
                .filter((c) => c.isActive !== false)
                .map((c) => ({ id: String(c._id), name: c.name }));
              walk(n.children);
            }
          });
        };
        walk(data.data || []);
        setCatKids(map);
      })
      .catch(() => {});
  }, []);

  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const productType = searchParams.get('type') || '';
  const brand = searchParams.get('brand') || '';
  const sort = searchParams.get('sort') || '-createdAt';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const inStock = searchParams.get('inStock') || '';
  const scope = searchParams.get('scope') || '';

  // Search uses offset pages; browse uses cursor
  const useCursor = !search;

  const buildParams = useCallback(
    (extra = {}) => {
      const params = {
        limit: 20,
        sort,
        isActive: true,
        ...extra,
      };
      if (search) params.search = search;
      if (category) params.category = category;
      if (productType) params.productType = productType;
      if (brand) params.brand = brand;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      if (inStock) params.inStock = inStock;
      if (scope) params.scope = scope;
      return params;
    },
    [search, category, productType, brand, sort, minPrice, maxPrice, inStock, scope]
  );

  // Grocery scope note: which areas serve grocery (admin-managed)
  useEffect(() => {
    if (productType !== 'GROCERY') return;
    api.get('/delivery-areas/active')
      .then(({ data }) => setGroceryAreas((data.data || []).filter((a) => a.groceryDelivery)))
      .catch(() => {});
  }, [productType]);

  // Reset list when filters change
  useEffect(() => {    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setProducts([]);
      setNextCursor(null);
      setPage(1);
      setHasMore(true);
      try {
        const params = buildParams(
          useCursor
            ? { pagination: 'cursor', facets: true, includeTotal: true }
            : { page: 1, facets: true }
        );
        const res = await getProducts(params);
        if (cancelled) return;
        setProducts(res.data || []);
        setFacets(res.facets || null);
        setSearchMeta(res.searchMeta || null);
        setTotal(res.total ?? res.pagination?.total ?? (res.data || []).length);
        if (useCursor) {
          setNextCursor(res.pagination?.nextCursor || null);
          setHasMore(Boolean(res.pagination?.hasMore));
        } else {
          const pages = res.pages || res.pagination?.pages || 1;
          setHasMore(1 < pages);
          setPage(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load');
          setProducts([]);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildParams, useCursor]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      if (useCursor) {
        if (!nextCursor) {
          setHasMore(false);
          return;
        }
        const res = await getProducts(
          buildParams({ pagination: 'cursor', cursor: nextCursor, facets: false })
        );
        const list = res.data || [];
        setProducts((prev) => [...prev, ...list]);
        setNextCursor(res.pagination?.nextCursor || null);
        setHasMore(Boolean(res.pagination?.hasMore));
      } else {
        const nextPage = page + 1;
        const res = await getProducts(buildParams({ page: nextPage, facets: false }));
        const list = res.data || [];
        setProducts((prev) => [...prev, ...list]);
        setPage(nextPage);
        const pages = res.pages || res.pagination?.pages || 1;
        setHasMore(nextPage < pages);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Load more failed');
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, useCursor, nextCursor, page, buildParams]);

  const sentinelRef = useInfiniteScroll(loadMore, {
    hasMore,
    loading: loading || loadingMore,
    rootMargin: '240px 0px',
    threshold: 0,
    enabled: !loading && products.length > 0,
  });

  const updateParam = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params);
  };

  const clearFilters = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    setSearchParams(params);
  };

  const hasFilters = category || productType || brand || minPrice || maxPrice || inStock;

  const FacetPanel = () => (
    <div className="space-y-5 text-sm">
      {searchMeta?.expandedTerms?.length > 0 && (
        <div>
          <h3 className="font-semibold text-primary-900 dark:text-primary-100 mb-2 text-xs uppercase tracking-wide">
            Related
          </h3>
          <div className="flex flex-wrap gap-1">
            {searchMeta.expandedTerms.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => updateParam('search', term)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/40"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {facets?.categories?.length > 0 && (
        <div>
          <h3 className="font-semibold text-xs uppercase tracking-wide mb-2">Category</h3>
          <ul className="space-y-1">
            {facets.categories.map((c) => {
              const kids = catKids[String(c.id)] || [];
              const subActive = kids.some((k) => category === k.id);
              const expanded = category === String(c.id) || subActive;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() =>
                      updateParam('category', category === String(c.id) ? '' : String(c.id))
                    }
                    className={`w-full flex justify-between px-2 py-1.5 rounded-lg ${
                      expanded
                        ? 'bg-primary-100 dark:bg-primary-800 font-medium'
                        : 'hover:bg-primary-50 dark:hover:bg-primary-900/40'
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="text-[10px] text-gray-500">{c.count}</span>
                  </button>
                  {/* Sub categories — simple dropdown below parent */}
                  {kids.length > 0 && expanded && (
                    <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-gold-400/50 pl-1.5">
                      {kids.map((k) => (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => updateParam('category', category === k.id ? '' : k.id)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[13px] ${
                            category === k.id
                              ? 'bg-primary-100 dark:bg-primary-800 font-medium'
                              : 'hover:bg-primary-50 dark:hover:bg-primary-900/40'
                          }`}
                        >
                          {k.name}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {facets?.brands?.length > 0 && (
        <div>
          <h3 className="font-semibold text-xs uppercase tracking-wide mb-2">Brand</h3>
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {facets.brands.map((b) => (
              <li key={b.name}>
                <button
                  type="button"
                  onClick={() => updateParam('brand', brand === b.name ? '' : b.name)}
                  className={`w-full flex justify-between px-2 py-1.5 rounded-lg ${
                    brand === b.name
                      ? 'bg-primary-100 dark:bg-primary-800 font-medium'
                      : 'hover:bg-primary-50 dark:hover:bg-primary-900/40'
                  }`}
                >
                  <span className="truncate">{b.name}</span>
                  <span className="text-[10px] text-gray-500">{b.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {facets?.price?.buckets?.length > 0 && (
        <div>
          <h3 className="font-semibold text-xs uppercase tracking-wide mb-2">Price</h3>
          <ul className="space-y-1">
            {facets.price.buckets.map((b, i) => {
              const from = typeof b.from === 'number' ? b.from : '';
              const to =
                typeof b.from === 'number'
                  ? [100, 200, 500, 1000, 2000, 5000].find((x) => x > b.from)
                  : '';
              const active =
                minPrice === String(from) &&
                (to ? maxPrice === String(to) : true);
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      const p = new URLSearchParams(searchParams);
                      if (active) {
                        p.delete('minPrice');
                        p.delete('maxPrice');
                      } else {
                        if (from !== '') p.set('minPrice', String(from));
                        if (to) p.set('maxPrice', String(to));
                        else p.set('maxPrice', '100000');
                      }
                      setSearchParams(p);
                    }}
                    className={`w-full flex justify-between px-2 py-1.5 rounded-lg ${
                      active
                        ? 'bg-primary-100 dark:bg-primary-800 font-medium'
                        : 'hover:bg-primary-50 dark:hover:bg-primary-900/40'
                    }`}
                  >
                    <span>{b.label}</span>
                    <span className="text-[10px] text-gray-500">{b.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {facets?.stock && (
        <div>
          <h3 className="font-semibold text-xs uppercase tracking-wide mb-2">Availability</h3>
          <button
            type="button"
            onClick={() => updateParam('inStock', inStock === 'true' ? '' : 'true')}
            className={`w-full flex justify-between px-2 py-1.5 rounded-lg mb-1 ${
              inStock === 'true' ? 'bg-primary-100 dark:bg-primary-800 font-medium' : ''
            }`}
          >
            <span>In stock</span>
            <span className="text-[10px] text-gray-500">{facets.stock.inStock}</span>
          </button>
        </div>
      )}

      {hasFilters && (
        <button type="button" onClick={clearFilters} className="btn-outline w-full text-xs py-2">
          Clear filters
        </button>
      )}
    </div>
  );

  return (
    <>
      <SEO title="Shop" description="Browse Madina Bazar products" path="/shop" />
      <div className="container-app py-4 sm:py-8">
        <div className="flex items-center justify-between mb-4 gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-primary-900 dark:text-primary-50">
              {t('shop')}
            </h1>
            <p className="text-xs text-gray-500">
              {total != null ? `${total} products` : `${products.length} loaded`}
              {search ? ` · “${search}”` : ''}
              <span className="text-gray-400"> · scroll for more</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => updateParam('sort', e.target.value)}
              className="input py-1.5 text-xs w-auto"
            >
              <option value="-createdAt">Newest</option>
              <option value="salePrice">Price ↑</option>
              <option value="-salePrice">Price ↓</option>
              <option value="name">Name A–Z</option>
            </select>
            <button
              type="button"
              className="lg:hidden btn-outline text-xs py-1.5"
              onClick={() => setShowFilters(true)}
            >
              <Filter className="w-4 h-4" /> Filters
            </button>
          </div>
        </div>

        {/* Grocery delivery scope note (areas + admin note) */}
        {productType === 'GROCERY' && (
          <div className="mb-4 rounded-xl border border-gold-400/40 bg-gold-400/10 dark:bg-gold-400/10 px-4 py-3 text-sm">
            <p className="font-semibold text-gold-700 dark:text-gold-300">
              🛵 Grocery delivery available {groceryAreas.length ? `only in: ${groceryAreas.map((a) => a.name).join(', ')}` : 'in selected areas'}
            </p>
            {groceryAreas.filter((a) => a.deliveryNote).map((a) => (
              <p key={a._id} className="text-xs text-gray-600 dark:text-ash mt-1">
                <b>{a.name}:</b> {a.deliveryNote}
              </p>
            ))}
          </div>
        )}

        <div className="flex gap-6">
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="card p-4 sticky top-20">
              <h2 className="font-bold text-sm mb-3">Filters</h2>
              <FacetPanel />
            </div>
          </aside>

          {showFilters && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
              <div className="absolute right-0 top-0 bottom-0 w-[min(100%,20rem)] bg-white dark:bg-[#12241a] p-4 overflow-y-auto">
                <div className="flex justify-between mb-4">
                  <h2 className="font-bold">Filters</h2>
                  <button type="button" onClick={() => setShowFilters(false)}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <FacetPanel />
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="card animate-pulse">
                    <div className="aspect-square bg-primary-50 dark:bg-primary-900/30" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 bg-primary-50 dark:bg-primary-900/30 rounded" />
                      <div className="h-3 w-1/2 bg-primary-50 dark:bg-primary-900/30 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500">No products found</p>
                <button type="button" onClick={clearFilters} className="btn-primary mt-4 text-sm">
                  Clear Filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {products.map((product) => (
                    <ProductCard key={product._id} product={product} />
                  ))}
                </div>

                {/* Infinite scroll sentinel + status */}
                <div ref={sentinelRef} className="h-8" aria-hidden />

                <div className="flex flex-col items-center gap-2 py-6">
                  {loadingMore && (
                    <div className="flex items-center gap-2 text-sm text-primary-700 dark:text-primary-300">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading more…
                    </div>
                  )}
                  {!hasMore && products.length > 0 && (
                    <p className="text-xs text-gray-500">You’re all caught up</p>
                  )}
                  {hasMore && !loadingMore && (
                    <button type="button" onClick={loadMore} className="btn-outline text-xs py-2 px-4">
                      Load more
                    </button>
                  )}
                  {error && <p className="text-xs text-red-500">{error}</p>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

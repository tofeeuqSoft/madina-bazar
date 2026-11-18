import { useState, useCallback, useRef } from 'react';
import { getProducts } from '../services/productService';

/**
 * Cursor-based product list for infinite scroll
 */
export default function useCursorProducts() {
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [facets, setFacets] = useState(null);
  const [searchMeta, setSearchMeta] = useState(null);
  const [total, setTotal] = useState(null);
  const [error, setError] = useState(null);
  const paramsRef = useRef({});
  const loadingRef = useRef(false);

  const fetchPage = useCallback(async (params, cursor, { replace = false, withFacets = false } = {}) => {
    if (loadingRef.current) return null;
    loadingRef.current = true;
    if (replace) setInitialLoading(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await getProducts({
        ...params,
        pagination: 'cursor',
        cursor: cursor || undefined,
        limit: params.limit || 20,
        isActive: true,
        facets: withFacets ? true : false,
        includeTotal: replace ? true : undefined,
      });

      const list = res.data || [];
      setItems((prev) => (replace ? list : [...prev, ...list]));
      const pag = res.pagination || {};
      setNextCursor(pag.nextCursor || null);
      setHasMore(Boolean(pag.hasMore));
      if (withFacets && res.facets) setFacets(res.facets);
      if (res.searchMeta) setSearchMeta(res.searchMeta);
      if (res.total != null) setTotal(res.total);
      return res;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      if (replace) {
        setItems([]);
        setHasMore(false);
      }
      return null;
    } finally {
      setLoading(false);
      setInitialLoading(false);
      loadingRef.current = false;
    }
  }, []);

  const reset = useCallback(
    async (params = {}) => {
      paramsRef.current = { ...params };
      setNextCursor(null);
      setHasMore(true);
      return fetchPage(params, null, { replace: true, withFacets: true });
    },
    [fetchPage]
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingRef.current) return;
    const cursor = nextCursor;
    if (!cursor && items.length > 0) return;
    await fetchPage(paramsRef.current, cursor, { replace: false });
  }, [fetchPage, hasMore, nextCursor, items.length]);

  return {
    items,
    facets,
    searchMeta,
    total,
    nextCursor,
    hasMore,
    loading,
    initialLoading,
    error,
    loadMore,
    reset,
  };
}

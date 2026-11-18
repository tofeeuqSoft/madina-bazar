import { useEffect, useRef, useCallback } from 'react';

/**
 * Performance-oriented infinite scroll observer
 *
 * Optimizations:
 * - Callback stored in ref → observer not recreated every render
 * - Disconnect while loading / when !hasMore
 * - rAF coalesce multiple intersection events
 * - Single observer instance, observe only sentinel
 * - rootMargin triggers early without tight threshold spam
 */
export default function useInfiniteScroll(
  onLoadMore,
  {
    hasMore = true,
    loading = false,
    rootMargin = '240px 0px',
    threshold = 0,
    enabled = true,
  } = {}
) {
  const sentinelRef = useRef(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const stateRef = useRef({ hasMore, loading, enabled });
  const lockedRef = useRef(false);
  const rafRef = useRef(0);
  const observerRef = useRef(null);

  // Keep latest values without re-binding observer
  onLoadMoreRef.current = onLoadMore;
  stateRef.current = { hasMore, loading, enabled };

  const tryLoad = useCallback(() => {
    const { hasMore: more, loading: busy, enabled: on } = stateRef.current;
    if (!on || !more || busy || lockedRef.current) return;

    lockedRef.current = true;
    Promise.resolve(onLoadMoreRef.current?.())
      .catch(() => {})
      .finally(() => {
        // Cooldown prevents rapid re-entry when sentinel stays visible
        window.setTimeout(() => {
          lockedRef.current = false;
        }, 400);
      });
  }, []);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;

    // Tear down previous
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    // No need to observe when finished or disabled
    if (!enabled || !hasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;

        // Coalesce bursts into one frame
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          // Skip if currently loading (checked live via ref)
          if (stateRef.current.loading) return;
          tryLoad();
        });
      },
      {
        root: null,
        rootMargin,
        threshold,
      }
    );

    observerRef.current = observer;
    observer.observe(node);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      observer.disconnect();
      observerRef.current = null;
    };
    // Re-create only when these structural opts change — not on every loading toggle
  }, [enabled, hasMore, rootMargin, threshold, tryLoad]);

  // Pause observation while loading to cut callback noise
  useEffect(() => {
    const observer = observerRef.current;
    const node = sentinelRef.current;
    if (!observer || !node) return;

    if (loading || !hasMore || !enabled) {
      observer.unobserve(node);
    } else {
      observer.observe(node);
    }
  }, [loading, hasMore, enabled]);

  return sentinelRef;
}

# Infinite Scroll UX Pattern

## Flow
1. Initial load → first page (cursor or offset)
2. Sentinel div at bottom observed with **IntersectionObserver** (`rootMargin: 280px`)
3. Near viewport → `loadMore()` appends next page
4. Filter/search change → **reset** list + cursor/page
5. End → `hasMore: false` → “You’re all caught up”

## Dual strategy
| Context | Mode |
|---------|------|
| Browse / filters | **Cursor** (`pagination=cursor`) |
| Text query | **Offset pages** (relevance rank) |

## UX details
- Skeleton on first load
- Spinner on load more
- Manual **Load more** button (fallback / accessibility)
- Lock flag prevents double-fetch
- `rootMargin: 200–300px` preloads before user hits bottom

## Hooks
- `useInfiniteScroll(onLoadMore, { hasMore, loading })` → `sentinelRef`
- `useCursorProducts()` for reusable cursor lists

## Shop
`/shop` uses infinite scroll by default.

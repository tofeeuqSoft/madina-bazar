# Cursor-based Pagination

## Why cursor?
- Stable under inserts/deletes (no skip drift)
- Faster on large collections (no large `skip`)
- Ideal for infinite scroll / "Load more"

## API

### Enable cursor mode
```
GET /api/products?pagination=cursor&limit=20&sort=-createdAt
GET /api/products?cursor=<nextCursor>&pagination=cursor&limit=20
```

Optional total:
```
&includeTotal=true
```

### Response
```json
{
  "success": true,
  "data": [ ... ],
  "count": 20,
  "total": null,
  "pagination": {
    "type": "cursor",
    "nextCursor": "eyJpZCI6Ii4uLiIsInNvcnRWYWx1ZSI6IjIwMjYtLi4uIn0",
    "hasMore": true,
    "limit": 20
  },
  "facets": { ... }
}
```

### Offset (still default)
```
GET /api/products?page=2&limit=20
→ pagination.type = "offset"
```

## Cursor format
Base64url JSON:
```json
{ "id": "<ObjectId>", "sortValue": "<field value>", "sort": "-createdAt" }
```

Sort is always **field + `_id`** for stability.

## Rules
1. Same `sort` must be used for the whole session
2. Search + relevance re-rank uses **offset** (cursor disabled when `search` present)
3. `limit` max 50
4. `hasMore: false` / `nextCursor: null` → end

## Frontend hook
```js
import useCursorProducts from '../hooks/useCursorProducts';

const { items, loadMore, hasMore, loading, reset } = useCursorProducts({
  category: id,
  sort: '-createdAt',
  limit: 20,
});

// initial
useEffect(() => { reset(); }, [category]);

// infinite scroll
<button disabled={!hasMore || loading} onClick={loadMore}>
  Load more
</button>
```

## Implementation
`backend/utils/cursorPagination.js` — reusable for Orders, etc.

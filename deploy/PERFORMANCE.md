# Performance Optimizations

## Backend
- MongoDB indexes: products, categories, orders, users
- `compression` gzip for API responses
- `.lean()` on product list queries
- Static `/uploads` cached 7 days
- Rate limiting on `/api`

```bash
cd backend && npm install compression
```

## Frontend
- Route-level code splitting (`React.lazy`)
- Manual chunks: vendor / ui / state
- `memo` on ProductCard
- Image `loading="lazy"`
- Vite build target es2018, css code split

## Checklist
1. Images: use compressed WebP/JPEG &lt; 200KB
2. Cloudinary with transforms for thumbnails
3. Enable CDN in production for `/uploads` and assets
4. MongoDB Atlas or tuned WiredTiger cache
5. PM2 cluster mode if multi-core: `instances: 'max'`

# Image CDN Caching

## Layers

1. **Cloudinary CDN** (global)  
   - Automatic edge cache for every delivery URL  
   - Unique `public_id` + version → long-lived cache  
   - Transforms (`f_auto,q_auto,w_*`) each get their own cache key  

2. **Local `/uploads`** (Express)  
   - `Cache-Control: public, max-age=31536000, immutable`  
   - `ETag` + `Last-Modified`  
   - Filenames are unique timestamps → safe immutable cache  

3. **Nginx** (production)  
   - `expires 365d` on `/uploads/`  
   - `stale-while-revalidate`  
   - `access_log off` for media  

4. **Browser**  
   - Caches by full URL (including transform string)  
   - `OptimizedImage` uses lazy + srcset  

## Cache headers (local media)

```
Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400
CDN-Cache-Control: public, max-age=31536000
```

## Purge / update

- **Cloudinary:** upload new file (new public_id) or invalidate via API  
- **Local:** new filename on every upload — old URL stays cached (correct)  

## Cloudflare (optional)

If site is behind Cloudflare, create Cache Rule:
- URI Path contains `/uploads` → Edge TTL 1 year, Browser TTL 1 year  
- Or cache everything from `res.cloudinary.com` (already done by Cloudinary)

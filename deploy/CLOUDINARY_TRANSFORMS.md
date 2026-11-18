# Optimized Cloudinary Image Transformations

## Presets

| Name | Size | Use |
|------|------|-----|
| `thumb` | 120×120 fill | Admin tables, tiny previews |
| `card` | 400×400 fill | Product grid cards |
| `detail` | 900×900 limit | Product detail page |
| `hero` | 1400×600 fill | Banners |
| `og` | 1200×630 jpg | Social share |
| `master` | ≤2000 limit | Stored master |

All use **`f_auto`** (WebP/AVIF when supported) + **`q_auto`** + **`dpr_auto`**.

## Upload behaviour
- Master capped at 2000px
- **Eager** async: thumb, card, detail pre-warmed on CDN
- API returns `url` (card), `urlThumb`, `urlDetail`, `srcSet`, `publicId`

## Frontend
```js
import { cldUrl, cldSrcSet, productImage } from '../utils/cloudinary';

<img
  src={cldUrl(url, 'card')}
  srcSet={cldSrcSet(url)}
  sizes="(max-width: 640px) 50vw, 25vw"
  loading="lazy"
/>
```

Optional: `VITE_CLOUDINARY_CLOUD_NAME=your_cloud` in frontend `.env` for publicId-only URLs.

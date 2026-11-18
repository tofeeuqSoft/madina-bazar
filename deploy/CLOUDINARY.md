# Cloudinary Integration

## 1. Create account
https://cloudinary.com → Dashboard → copy **Cloud name**, **API Key**, **API Secret**

## 2. Backend `.env`
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=madina-bazar
```

## 3. Install
```bash
cd backend
npm install cloudinary sharp
npm run dev
```

Console should show: `☁️  Cloudinary: enabled`

## 4. Behaviour
| Media | Upload | Optimize |
|-------|--------|----------|
| Image | Cloudinary folder `madina-bazar/images` | `q_auto`, `f_auto`, max 1600px |
| Video | `madina-bazar/videos` | Cloudinary video CDN |
| No config | Local `/uploads` | Sharp → WebP |

## 5. API
- `POST /api/upload/multiple` — returns `{ url, publicId, provider: "cloudinary", type }`
- `DELETE /api/upload/cloudinary` — body `{ publicId, type: "image"|"video" }`
- `GET /api/upload/status` — `{ cloudinary: true/false }`

## 6. Admin
Product form Media uploader automatically uses Cloudinary when configured — no frontend change needed.

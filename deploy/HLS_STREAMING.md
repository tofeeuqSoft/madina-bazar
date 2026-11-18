# HLS Adaptive Streaming (Cloudinary)

## How it works
1. **Upload** — eager transform generates `.m3u8` with `streaming_profile: hd` (or env)
2. **CDN** — Cloudinary serves multiple bitrates (adaptive ABR)
3. **Player** — Safari native HLS; Chrome/Firefox via **hls.js** (CDN, auto fallback to MP4)

## URLs
```
https://res.cloudinary.com/<cloud>/video/upload/sp_auto/<publicId>.m3u8
https://res.cloudinary.com/<cloud>/video/upload/sp_hd/<publicId>.m3u8
```

## Profiles
| Profile | Env / API |
|---------|-----------|
| auto | `sp_auto` (default delivery) |
| hd | `CLOUDINARY_STREAMING_PROFILE=hd` |
| full_hd | `full_hd` |
| sd | `sd` |

## Response fields
`hls`, `hlsHd`, `mp4`, `poster`, `urlPreview`, `publicId`

## Frontend
```jsx
<OptimizedVideo
  src={video.url}
  publicId={video.publicId}
  hls={video.hls}
  poster={video.poster}
  preferHls
/>
```

## Notes
- Streaming profiles may require Cloudinary **Video** plan features
- If HLS fails, player automatically falls back to optimized MP4
- `preload="metadata"` keeps first load light

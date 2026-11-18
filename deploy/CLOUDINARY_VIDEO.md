# Cloudinary Video Optimization

## Upload
- Transcode → H.264 + AAC, max width 1280, bitrate ~1 Mbps
- Eager (async): preview (640p), teaser (5s), poster JPG
- Folder: madina-bazar/videos

## Delivery presets
| Preset | Spec | Use |
|--------|------|-----|
| detail | 1280p, q_auto, ~1Mbps | Product page |
| preview | 640p, 500kbps | Cards / admin |
| teaser | 400p, 5 seconds | Hover preview |
| poster | 640×360 JPG | Thumbnail |
| hls | sp_auto adaptive | Advanced players |

## API response
url, urlPreview, urlTeaser, poster, hls, publicId, duration

## Frontend
```jsx
<OptimizedVideo src={video.url} poster={video.poster} preset="detail" />
```

## Optional env
CLOUDINARY_VIDEO_MAX_DURATION=60

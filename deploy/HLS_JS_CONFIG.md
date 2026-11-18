# HLS.js Configuration Options

Config file: `frontend/src/config/hlsConfig.js`  
Player: `OptimizedVideo` prop `hlsConfig`

## Profiles

| Profile | When |
|---------|------|
| `auto` | Mobile → mobile profile, else detail |
| `default` | Balanced VoD |
| `mobile` | Smaller buffers, lower ABR estimate |
| `detail` | Product page, higher quality bias |
| `lowLatency` | Live-style (rarely needed for products) |

## Key options

```js
{
  enableWorker: true,          // demux off main thread
  lowLatencyMode: false,       // VoD = false
  maxBufferLength: 30,         // forward buffer (s)
  maxMaxBufferLength: 60,
  maxBufferSize: 60_000_000,   // bytes
  backBufferLength: 30,        // trim played buffer
  abrEwmaDefaultEstimate: 500000,
  abrBandWidthFactor: 0.95,    // conservative ABR
  abrBandWidthUpFactor: 0.7,   // slow quality ramp-up
  capLevelToPlayerSize: true,  // match pixel size
  startLevel: -1,              // auto start quality
  startFragPrefetch: true,
  testBandwidth: true,
  fragLoadingTimeOut: 20000,
  fragLoadingMaxRetry: 4,
}
```

## Usage

```jsx
// Auto (recommended)
<OptimizedVideo src={url} hls={hls} preferHls hlsConfig="auto" />

// Product detail
<OptimizedVideo hlsConfig="detail" ... />

// Custom merge
<OptimizedVideo
  hlsConfig={{ maxBufferLength: 20, startLevel: 0 }}
  onHlsEvent={(name, data) => console.log(name, data)}
/>
```

## Error recovery
1. `NETWORK_ERROR` → `startLoad()`
2. `MEDIA_ERROR` → `recoverMediaError()`
3. Other fatal → destroy HLS → **MP4 fallback**

## Events (`onHlsEvent`)
`nativeHls` | `manifestParsed` | `levelSwitched` | `error` | `fallbackMp4` | `mp4` | `hlsLoadError`

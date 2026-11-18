/**
 * HLS.js configuration for Madina Bazar / Cloudinary adaptive streams
 * Docs: https://github.com/video-dev/hls.js/blob/master/docs/API.md
 */

export const HLS_DEFAULT_CONFIG = {
  enableWorker: true,
  lowLatencyMode: false,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  maxBufferSize: 60 * 1000 * 1000,
  maxBufferHole: 0.5,
  backBufferLength: 30,
  abrEwmaDefaultEstimate: 500000,
  abrEwmaFastLive: 3.0,
  abrEwmaSlowLive: 9.0,
  abrEwmaFastVoD: 3.0,
  abrEwmaSlowVoD: 9.0,
  abrBandWidthFactor: 0.95,
  abrBandWidthUpFactor: 0.7,
  abrMaxWithRealBitrate: false,
  startLevel: -1,
  manifestLoadingTimeOut: 15000,
  manifestLoadingMaxRetry: 3,
  levelLoadingTimeOut: 15000,
  levelLoadingMaxRetry: 3,
  fragLoadingTimeOut: 20000,
  fragLoadingMaxRetry: 4,
  startFragPrefetch: true,
  testBandwidth: true,
  progressive: false,
  capLevelToPlayerSize: true,
  xhrSetup: undefined,
};

export const HLS_MOBILE_CONFIG = {
  ...HLS_DEFAULT_CONFIG,
  maxBufferLength: 20,
  maxMaxBufferLength: 40,
  maxBufferSize: 30 * 1000 * 1000,
  abrEwmaDefaultEstimate: 300000,
  abrBandWidthFactor: 0.85,
  capLevelToPlayerSize: true,
};

export const HLS_DETAIL_CONFIG = {
  ...HLS_DEFAULT_CONFIG,
  maxBufferLength: 45,
  maxMaxBufferLength: 90,
  abrEwmaDefaultEstimate: 800000,
  abrBandWidthUpFactor: 0.8,
  startFragPrefetch: true,
};

export const HLS_LOW_LATENCY_CONFIG = {
  ...HLS_DEFAULT_CONFIG,
  lowLatencyMode: true,
  backBufferLength: 12,
  maxBufferLength: 15,
  liveSyncDurationCount: 3,
  liveMaxLatencyDurationCount: 6,
};

export function getHlsConfig(profile = 'default') {
  if (profile && typeof profile === 'object') {
    return { ...HLS_DEFAULT_CONFIG, ...profile };
  }
  switch (profile) {
    case 'mobile':
      return HLS_MOBILE_CONFIG;
    case 'detail':
      return HLS_DETAIL_CONFIG;
    case 'lowLatency':
      return HLS_LOW_LATENCY_CONFIG;
    default:
      return HLS_DEFAULT_CONFIG;
  }
}

export function autoHlsProfile() {
  if (typeof navigator === 'undefined') return 'default';
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return mobile ? 'mobile' : 'detail';
}

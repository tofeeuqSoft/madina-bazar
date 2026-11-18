import { useEffect, useRef, useState } from 'react';
import { cldVideoUrl, cldVideoPoster } from '../../utils/cloudinary';
import { getHlsConfig, autoHlsProfile } from '../../config/hlsConfig';

function canPlayNativeHls(video) {
  if (!video) return false;
  const t = video.canPlayType('application/vnd.apple.mpegurl');
  return t === 'probably' || t === 'maybe';
}

async function loadHlsJs() {
  if (typeof window !== 'undefined' && window.Hls) return window.Hls;
  const mod = await import('https://cdn.jsdelivr.net/npm/hls.js@1.5.17/+esm');
  const Hls = mod.default || mod.Hls || mod;
  if (typeof window !== 'undefined') window.Hls = Hls;
  return Hls;
}

function resolveHlsUrl({ hlsUrlProp, raw, publicId, preferHls }) {
  if (!preferHls) return null;
  if (hlsUrlProp) return hlsUrlProp;
  if (!raw) return null;
  const s = String(raw);
  if (s.includes('.m3u8')) return s;
  if (s.includes('res.cloudinary.com')) {
    return s
      .replace('/image/upload/', '/video/upload/')
      .replace(/\/upload\/(?:[^/]+\/)?/, '/upload/sp_auto/')
      .replace(/\.(mp4|webm|mov)(\?.*)?$/i, '.m3u8');
  }
  const cloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const id = publicId || (!s.includes('/') && !s.startsWith('http') ? s : null);
  if (cloud && id) {
    return `https://res.cloudinary.com/${cloud}/video/upload/sp_auto/${id}.m3u8`;
  }
  return null;
}

/**
 * OptimizedVideo — HLS.js + Cloudinary
 *
 * Props:
 * - hlsConfig: 'default' | 'mobile' | 'detail' | 'lowLatency' | partial config object
 * - onHlsEvent: optional (eventName, data) => void
 * - preferHls: boolean (default true)
 */
export default function OptimizedVideo({
  src,
  publicId,
  hls: hlsUrlProp,
  poster,
  className = 'w-full rounded-xl bg-black max-h-64',
  controls = true,
  autoPlay = false,
  muted = false,
  loop = false,
  preset = 'detail',
  preferHls = true,
  hlsConfig = 'auto',
  onHlsEvent,
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState(null);

  const raw = src || publicId;
  const mp4Src = raw ? cldVideoUrl(raw, preset) || raw : '';
  const posterSrc = poster || (raw ? cldVideoPoster(raw) : undefined);
  const derivedHls = resolveHlsUrl({ hlsUrlProp, raw, publicId, preferHls });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    setError(null);
    let destroyed = false;

    const profile =
      hlsConfig === 'auto' ? autoHlsProfile() : hlsConfig;
    const config = getHlsConfig(profile);

    const attach = async () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (derivedHls && preferHls) {
        if (canPlayNativeHls(video)) {
          video.src = derivedHls;
          onHlsEvent?.('nativeHls', { url: derivedHls });
          return;
        }

        try {
          const Hls = await loadHlsJs();
          if (destroyed) return;

          if (Hls?.isSupported?.()) {
            const hls = new Hls(config);
            hlsRef.current = hls;
            hls.loadSource(derivedHls);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
              onHlsEvent?.('manifestParsed', data);
              if (autoPlay) {
                video.play().catch(() => {});
              }
            });

            hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
              onHlsEvent?.('levelSwitched', data);
            });

            hls.on(Hls.Events.ERROR, (_, data) => {
              onHlsEvent?.('error', data);
              if (!data.fatal) return;

              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  hls.destroy();
                  hlsRef.current = null;
                  if (mp4Src) {
                    video.src = mp4Src;
                    onHlsEvent?.('fallbackMp4', { url: mp4Src });
                  } else {
                    setError('Video playback failed');
                  }
              }
            });
            return;
          }
        } catch (e) {
          console.warn('hls.js failed, MP4 fallback', e.message);
          onHlsEvent?.('hlsLoadError', { message: e.message });
        }
      }

      if (mp4Src) {
        video.src = mp4Src;
        onHlsEvent?.('mp4', { url: mp4Src });
      }
    };

    attach();

    return () => {
      destroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [derivedHls, mp4Src, preferHls, hlsConfig, autoPlay]);

  if (!raw && !hlsUrlProp) return null;

  return (
    <div className="relative">
      <video
        ref={videoRef}
        poster={posterSrc}
        controls={controls}
        autoPlay={autoPlay}
        muted={muted || autoPlay}
        loop={loop}
        playsInline
        preload="metadata"
        className={className}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

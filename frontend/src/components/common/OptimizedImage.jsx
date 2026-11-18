import { cldUrl, cldSrcSet } from '../../utils/cloudinary';

/**
 * Cache-friendly image: Cloudinary transforms + lazy + async decode
 * Browser caches by URL; Cloudinary CDN caches globally.
 */
export default function OptimizedImage({
  src,
  alt = '',
  preset = 'card',
  className = '',
  width,
  height,
  priority = false,
}) {
  if (!src) {
    return (
      <div
        className={`bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <span className="text-2xl opacity-40">🛒</span>
      </div>
    );
  }

  const optimized = cldUrl(src, preset) || src;
  const srcSet = cldSrcSet(src);

  return (
    <img
      src={optimized}
      srcSet={srcSet}
      sizes={
        preset === 'detail'
          ? '(max-width: 768px) 100vw, 50vw'
          : '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'
      }
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'auto'}
      // Hint: unique Cloudinary/local filenames are immutable
      crossOrigin="anonymous"
    />
  );
}

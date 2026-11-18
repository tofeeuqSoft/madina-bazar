/**
 * Long-lived CDN-style cache headers for images & videos
 * Use with express.static setHeaders or as middleware
 */

const ONE_YEAR = 365 * 24 * 60 * 60;
const ONE_WEEK = 7 * 24 * 60 * 60;
const ONE_DAY = 24 * 60 * 60;

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg|ico)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const FONT_EXT = /\.(woff2?|ttf|otf|eot)$/i;

export function mediaCacheHeaders(res, filePath = '') {
  const path = String(filePath);

  if (IMAGE_EXT.test(path) || VIDEO_EXT.test(path)) {
    // Fingerprinted / unique filenames → immutable long cache
    res.setHeader(
      'Cache-Control',
      `public, max-age=${ONE_YEAR}, s-maxage=${ONE_YEAR}, immutable, stale-while-revalidate=${ONE_DAY}`
    );
    res.setHeader('CDN-Cache-Control', `public, max-age=${ONE_YEAR}`);
    res.setHeader('Cloudflare-CDN-Cache-Control', `max-age=${ONE_YEAR}`);
    res.setHeader('Vary', 'Accept, Accept-Encoding');
    return;
  }

  if (FONT_EXT.test(path)) {
    res.setHeader(
      'Cache-Control',
      `public, max-age=${ONE_YEAR}, immutable`
    );
    return;
  }

  // Other static
  res.setHeader(
    'Cache-Control',
    `public, max-age=${ONE_WEEK}, stale-while-revalidate=${ONE_DAY}`
  );
}

/**
 * Middleware: force cache on /uploads/*
 */
export function uploadsCacheMiddleware(req, res, next) {
  mediaCacheHeaders(res, req.path);
  next();
}

export const staticUploadOptions = {
  maxAge: ONE_YEAR * 1000, // express expects ms
  etag: true,
  lastModified: true,
  fallthrough: true,
  setHeaders: mediaCacheHeaders,
};

/**
 * Client-side Cloudinary URL helpers
 * Works with full Cloudinary URLs or publicId + cloud name from env
 */

const CLOUD =
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ||
  '';

export const PRESETS = {
  thumb: 'w_120,h_120,c_fill,g_auto,q_auto:eco,f_auto,dpr_auto',
  card: 'w_400,h_400,c_fill,g_auto,q_auto:good,f_auto,dpr_auto',
  detail: 'w_900,h_900,c_limit,q_auto:best,f_auto,dpr_auto',
  hero: 'w_1400,h_600,c_fill,g_auto,q_auto:good,f_auto,dpr_auto',
};

/**
 * Inject transform into an existing Cloudinary delivery URL
 */
export function cldUrl(urlOrId, preset = 'card') {
  if (!urlOrId) return '';
  const transform =
    PRESETS[preset] || (typeof preset === 'string' ? preset : PRESETS.card);

  // Full Cloudinary URL
  if (String(urlOrId).includes('res.cloudinary.com')) {
    return String(urlOrId).replace(
      /\/upload\/(?:[^/]+\/)?(?=v\d+\/|[^/]+$)/,
      `/upload/${transform}/`
    );
  }

  // publicId only
  if (CLOUD) {
    return `https://res.cloudinary.com/${CLOUD}/image/upload/${transform}/${urlOrId}`;
  }

  return urlOrId;
}

export function cldSrcSet(urlOrId, widths = [200, 400, 800]) {
  if (!urlOrId) return undefined;
  if (!String(urlOrId).includes('res.cloudinary.com') && !CLOUD) return undefined;

  return widths
    .map((w) => {
      const u = cldUrl(urlOrId, `w_${w},c_limit,q_auto,f_auto,dpr_auto`);
      return `${u} ${w}w`;
    })
    .join(', ');
}

/** Pick best image field from product/media object */
export function productImage(product, preset = 'card') {
  const raw =
    product?.images?.[0]?.url ||
    product?.images?.[0] ||
    product?.url ||
    product;
  if (!raw || typeof raw !== 'string') return null;
  return cldUrl(raw, preset);
}

/** Video delivery presets */
export const VIDEO_PRESETS = {
  detail: 'w_1280,c_limit,q_auto,f_auto,br_1m,vc_h264,ac_aac',
  preview: 'w_640,c_limit,q_auto:eco,f_mp4,br_500k,vc_h264',
  teaser: 'w_400,c_limit,q_auto:eco,f_mp4,br_400k,du_5',
};

/**
 * Optimize Cloudinary video URL
 */
export function cldVideoUrl(urlOrId, preset = 'detail') {
  if (!urlOrId) return '';
  const transform =
    VIDEO_PRESETS[preset] ||
    (typeof preset === 'string' ? preset : VIDEO_PRESETS.detail);

  if (String(urlOrId).includes('res.cloudinary.com')) {
    // Ensure video/upload path and inject transform
    let u = String(urlOrId);
    if (u.includes('/image/upload/')) {
      u = u.replace('/image/upload/', '/video/upload/');
    }
    return u.replace(
      /\/upload\/(?:[^/]+\/)?(?=v\d+\/|[^/]+$)/,
      `/upload/${transform}/`
    );
  }

  if (CLOUD) {
    return `https://res.cloudinary.com/${CLOUD}/video/upload/${transform}/${urlOrId}`;
  }
  return urlOrId;
}

export function cldVideoPoster(urlOrId) {
  if (!urlOrId) return undefined;
  const base = cldVideoUrl(urlOrId, 'w_640,h_360,c_fill,g_auto,q_auto,so_0');
  if (!base) return undefined;
  // Poster as jpg frame
  if (base.includes('res.cloudinary.com')) {
    return base.replace(/\.(mp4|webm|mov)(\?.*)?$/i, '.jpg').replace(
      /\/upload\/([^/]+)\//,
      '/upload/w_640,h_360,c_fill,g_auto,q_auto,f_jpg,so_0/'
    );
  }
  return undefined;
}

/**
 * Cloudinary — optimized image transformations for Madina Bazar
 *
 * Upload stores a high-quality master; delivery uses named presets
 * (f_auto + q_auto) so each device gets the right size/format (WebP/AVIF).
 *
 * .env:
 *   CLOUDINARY_CLOUD_NAME=
 *   CLOUDINARY_API_KEY=
 *   CLOUDINARY_API_SECRET=
 *   CLOUDINARY_FOLDER=madina-bazar
 */

let cloudinary = null;
let configured = false;

export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

export async function getCloudinary() {
  if (!isCloudinaryConfigured()) return null;
  if (cloudinary && configured) return cloudinary;

  const mod = await import('cloudinary');
  cloudinary = mod.v2 || mod.default?.v2 || mod.default;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
  return cloudinary;
}

/**
 * Named transformation presets
 * Used on delivery URLs (not destructive to original)
 */
export const TRANSFORMS = {
  /** Tiny list / admin table */
  thumb: {
    width: 120,
    height: 120,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto:eco',
    fetch_format: 'auto',
    dpr: 'auto',
  },
  /** Product card grid */
  card: {
    width: 400,
    height: 400,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto:good',
    fetch_format: 'auto',
    dpr: 'auto',
  },
  /** Product detail main image */
  detail: {
    width: 900,
    height: 900,
    crop: 'limit',
    quality: 'auto:best',
    fetch_format: 'auto',
    dpr: 'auto',
  },
  /** Home / banner */
  hero: {
    width: 1400,
    height: 600,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto:good',
    fetch_format: 'auto',
    dpr: 'auto',
  },
  /** Social share OG */
  og: {
    width: 1200,
    height: 630,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto:good',
    fetch_format: 'jpg',
  },
  /** Master cap on upload (eager) */
  master: {
    width: 2000,
    height: 2000,
    crop: 'limit',
    quality: 'auto:best',
    fetch_format: 'auto',
  },
};

/** Convert preset object → Cloudinary URL transform string */
export function presetToString(preset) {
  const p = typeof preset === 'string' ? TRANSFORMS[preset] : preset;
  if (!p) return 'f_auto,q_auto';
  const parts = [];
  if (p.width) parts.push(`w_${p.width}`);
  if (p.height) parts.push(`h_${p.height}`);
  if (p.crop) parts.push(`c_${p.crop}`);
  if (p.gravity) parts.push(`g_${p.gravity}`);
  if (p.quality) parts.push(`q_${p.quality}`);
  if (p.fetch_format) parts.push(`f_${p.fetch_format}`);
  if (p.dpr) parts.push(`dpr_${p.dpr}`);
  return parts.join(',');
}

/**
 * Build optimized delivery URL from public_id
 * @param {string} publicId
 * @param {string|object} preset - 'thumb'|'card'|'detail'|'hero'|'og' or raw transform
 */
/**
 * Delivery URL with CDN caching — Cloudinary caches globally by URL.
 * Unique public_id + version = immutable cache forever until new upload.
 */
export function cloudinaryUrl(publicId, preset = 'card') {
  if (!publicId || !isCloudinaryConfigured()) return null;
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const transform =
    typeof preset === 'string' && !preset.includes(',')
      ? presetToString(preset)
      : typeof preset === 'object'
        ? presetToString(preset)
        : preset;
  return `https://res.cloudinary.com/${cloud}/image/upload/${transform}/${publicId}`;
}

/**
 * Responsive srcset for <img>
 */
/** Ensure transform string prefers cacheable, auto format */
export function cachedDeliveryUrl(publicId, preset = 'card', version) {
  const url = cloudinaryUrl(publicId, preset);
  if (!url) return url;
  // Version path already in Cloudinary URLs when using API secure_url
  if (version && !url.includes(`/v${version}/`)) {
    return url.replace('/upload/', `/upload/v${version}/`);
  }
  return url;
}

export function cloudinarySrcSet(publicId, widths = [200, 400, 800, 1200]) {
  if (!publicId || !isCloudinaryConfigured()) return '';
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  return widths
    .map(
      (w) =>
        `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,w_${w},c_limit,dpr_auto/${publicId} ${w}w`
    )
    .join(', ');
}

/**
 * All useful variants after upload
 */
export function buildImageVariants(publicId) {
  if (!publicId) return {};
  return {
    original: cloudinaryUrl(publicId, 'master'),
    thumb: cloudinaryUrl(publicId, 'thumb'),
    card: cloudinaryUrl(publicId, 'card'),
    detail: cloudinaryUrl(publicId, 'detail'),
    hero: cloudinaryUrl(publicId, 'hero'),
    og: cloudinaryUrl(publicId, 'og'),
    srcSet: cloudinarySrcSet(publicId),
  };
}


/** Video transformation presets */
export const VIDEO_TRANSFORMS = {
  /** Product detail player — balanced quality */
  detail: {
    quality: 'auto',
    fetch_format: 'auto',
    width: 1280,
    crop: 'limit',
    bit_rate: '1m',
    audio_codec: 'aac',
    video_codec: 'h264',
  },
  /** Card / preview loop */
  preview: {
    quality: 'auto:eco',
    fetch_format: 'mp4',
    width: 640,
    crop: 'limit',
    bit_rate: '500k',
    video_codec: 'h264',
  },
  /** Tiny poster frame as image */
  poster: {
    width: 640,
    height: 360,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto:good',
    fetch_format: 'jpg',
    start_offset: '0',
  },
  /** Short GIF-like preview (first seconds) */
  teaser: {
    width: 400,
    crop: 'limit',
    quality: 'auto:eco',
    fetch_format: 'mp4',
    bit_rate: '400k',
    duration: '5',
  },
};

function videoPresetToString(preset) {
  const p = typeof preset === 'string' ? VIDEO_TRANSFORMS[preset] : preset;
  if (!p) return 'q_auto,f_auto';
  const parts = [];
  if (p.width) parts.push(`w_${p.width}`);
  if (p.height) parts.push(`h_${p.height}`);
  if (p.crop) parts.push(`c_${p.crop}`);
  if (p.gravity) parts.push(`g_${p.gravity}`);
  if (p.quality) parts.push(`q_${p.quality}`);
  if (p.fetch_format) parts.push(`f_${p.fetch_format}`);
  if (p.bit_rate) parts.push(`br_${p.bit_rate}`);
  if (p.video_codec) parts.push(`vc_${p.video_codec}`);
  if (p.audio_codec) parts.push(`ac_${p.audio_codec}`);
  if (p.start_offset != null) parts.push(`so_${p.start_offset}`);
  if (p.duration) parts.push(`du_${p.duration}`);
  return parts.join(',');
}

/**
 * Optimized video delivery URL
 * @param {string} publicId
 * @param {'detail'|'preview'|'teaser'|object} preset
 */
export function cloudinaryVideoUrl(publicId, preset = 'detail') {
  if (!publicId || !isCloudinaryConfigured()) return null;
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const transform =
    typeof preset === 'string' && !preset.includes(',')
      ? videoPresetToString(preset)
      : typeof preset === 'object'
        ? videoPresetToString(preset)
        : preset;
  return `https://res.cloudinary.com/${cloud}/video/upload/${transform}/${publicId}`;
}

/**
 * JPG/WebP poster frame from video
 */
export function cloudinaryVideoPoster(publicId, preset = 'poster') {
  if (!publicId || !isCloudinaryConfigured()) return null;
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const transform = videoPresetToString(preset);
  // resource type image derived from video
  return `https://res.cloudinary.com/${cloud}/video/upload/${transform}/${publicId}.jpg`;
}

/**
 * HLS adaptive streaming URL (Cloudinary)
 */
/**
 * HLS adaptive streaming (.m3u8)
 * sp_auto — Cloudinary picks renditions; sp_hd / sp_full_hd for fixed profiles
 * @param {string} publicId
 * @param {'auto'|'hd'|'sd'|'full_hd'} profile
 */
export function cloudinaryVideoHls(publicId, profile = 'auto') {
  if (!publicId || !isCloudinaryConfigured()) return null;
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const sp =
    profile === 'hd'
      ? 'sp_hd'
      : profile === 'full_hd'
        ? 'sp_full_hd'
        : profile === 'sd'
          ? 'sp_sd'
          : 'sp_auto';
  // q_auto with streaming profile
  return `https://res.cloudinary.com/${cloud}/video/upload/${sp}/${publicId}.m3u8`;
}

/** MP4 fallback (single progressive file) for non-HLS browsers without hls.js */
export function cloudinaryVideoMp4(publicId) {
  return cloudinaryVideoUrl(publicId, 'detail');
}

export function buildVideoVariants(publicId) {
  if (!publicId) return {};
  return {
    detail: cloudinaryVideoUrl(publicId, 'detail'),
    preview: cloudinaryVideoUrl(publicId, 'preview'),
    teaser: cloudinaryVideoUrl(publicId, 'teaser'),
    poster: cloudinaryVideoPoster(publicId),
    hls: cloudinaryVideoHls(publicId, 'auto'),
    hlsHd: cloudinaryVideoHls(publicId, 'hd'),
    mp4: cloudinaryVideoUrl(publicId, 'detail'),
  };
}

/**
 * Upload with eager transforms pre-generated on CDN
 */
export async function cloudinaryUpload(filePath, options = {}) {
  const cld = await getCloudinary();
  if (!cld) throw new Error('Cloudinary is not configured');

  const folder = process.env.CLOUDINARY_FOLDER || 'madina-bazar';
  const isVideo = options.resource_type === 'video';

  const uploadOptions = {
    folder: isVideo ? `${folder}/videos` : `${folder}/images`,
    resource_type: isVideo ? 'video' : 'image',
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    ...options,
  };

  if (!isVideo) {
    uploadOptions.transformation = options.transformation || [
      { width: 2000, height: 2000, crop: 'limit' },
      { quality: 'auto:best', fetch_format: 'auto' },
    ];
    uploadOptions.eager = options.eager || [
      TRANSFORMS.thumb,
      TRANSFORMS.card,
      TRANSFORMS.detail,
    ];
    uploadOptions.eager_async = true;
    uploadOptions.invalidate = true;
  } else {
    // Video: transcode to efficient H.264, limit resolution/bitrate
    uploadOptions.transformation = options.transformation || [
      {
        width: 1280,
        crop: 'limit',
        quality: 'auto',
        fetch_format: 'mp4',
        bit_rate: '1m',
        video_codec: 'h264',
        audio_codec: 'aac',
      },
    ];
    uploadOptions.eager = options.eager || [
      VIDEO_TRANSFORMS.preview,
      VIDEO_TRANSFORMS.teaser,
      {
        width: 640,
        height: 360,
        crop: 'fill',
        gravity: 'auto',
        quality: 'auto:good',
        fetch_format: 'jpg',
        start_offset: '0',
        format: 'jpg',
      },
      // Pre-generate HLS adaptive playlist (requires Cloudinary video addon on some plans)
      {
        format: 'm3u8',
        streaming_profile: process.env.CLOUDINARY_STREAMING_PROFILE || 'hd',
      },
    ];
    uploadOptions.eager_async = true;
    uploadOptions.invalidate = true;
    // Max duration safeguard (seconds) — optional via env
    if (process.env.CLOUDINARY_VIDEO_MAX_DURATION) {
      uploadOptions.transformation.push({
        duration: process.env.CLOUDINARY_VIDEO_MAX_DURATION,
      });
    }
  }

  return cld.uploader.upload(filePath, uploadOptions);
}

export async function cloudinaryDestroy(publicId, resourceType = 'image') {
  const cld = await getCloudinary();
  if (!cld || !publicId) return null;
  return cld.uploader.destroy(publicId, {
    resource_type: resourceType === 'video' ? 'video' : 'image',
  });
}

/**
 * If URL is already Cloudinary, inject/replace transform segment
 */
export function optimizeCloudinaryUrl(url, preset = 'card') {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('res.cloudinary.com')) return url;

  const transform = presetToString(preset);
  // Match /upload/ or /upload/already_transforms/
  return url.replace(
    /\/upload\/(?:[^/]+\/)?(?=v\d+\/|[^/]+$)/,
    `/upload/${transform}/`
  );
}

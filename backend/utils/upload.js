/**
 * Multi image + video upload with optimization
 * Prefer Cloudinary when configured; else local disk + sharp WebP
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  isCloudinaryConfigured,
  cloudinaryUpload,
  cloudinaryDestroy,
  buildImageVariants,
  buildVideoVariants,
  cloudinaryUrl,
  cloudinaryVideoUrl,
} from '../config/cloudinary.js';

export { isCloudinaryConfigured, cloudinaryDestroy, cloudinaryUrl, buildImageVariants, buildVideoVariants, cloudinaryVideoUrl };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads');
const imagesDir = path.join(uploadsDir, 'images');
const videosDir = path.join(uploadsDir, 'videos');

for (const dir of [uploadsDir, imagesDir, videosDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export const MEDIA_LIMITS = {
  imageMaxMB: 8,
  videoMaxMB: 50,
  maxFiles: 12,
  imageFormats: ['jpeg', 'jpg', 'png', 'webp', 'gif'],
  videoFormats: ['mp4', 'webm', 'mov', 'quicktime'],
};

const isImage = (file) =>
  (file.mimetype || '').startsWith('image/') ||
  MEDIA_LIMITS.imageFormats.some((f) =>
    (file.originalname || '').toLowerCase().endsWith(`.${f}`)
  );

const isVideo = (file) =>
  (file.mimetype || '').startsWith('video/') ||
  MEDIA_LIMITS.videoFormats.some((f) =>
    (file.originalname || '').toLowerCase().endsWith(`.${f}`)
  );

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    cb(null, isVideo(file) ? videosDir : imagesDir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    let ext = path.extname(file.originalname).toLowerCase() || '';
    if (!ext) ext = isVideo(file) ? '.mp4' : '.jpg';
    cb(null, `${unique}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (isImage(file) || isVideo(file)) return cb(null, true);
  cb(
    new Error(
      'Only images (jpeg, png, webp, gif) and videos (mp4, webm, mov) are allowed'
    )
  );
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MEDIA_LIMITS.videoMaxMB * 1024 * 1024,
    files: MEDIA_LIMITS.maxFiles,
  },
});

async function optimizeImage(filePath) {
  try {
    const sharp = (await import('sharp')).default;
    const outPath = filePath.replace(/(\.[^.]+)$/, '.webp');
    await sharp(filePath)
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 78, effort: 4 })
      .toFile(outPath);

    if (outPath !== filePath) {
      try {
        fs.unlinkSync(filePath);
      } catch (_) {}
    }
    return outPath;
  } catch (err) {
    if (!String(err.message || err).includes('Cannot find module')) {
      console.warn('Image optimize skip:', err.message);
    }
    return filePath;
  }
}

function publicUrl(req, relativePath) {
  const base =
    process.env.API_URL || `${req.protocol}://${req.get('host')}`;
  const clean = relativePath.replace(/\\/g, '/');
  if (clean.startsWith('http')) return clean;
  return `${base}/${clean.startsWith('/') ? clean.slice(1) : clean}`;
}

export const processUploadedFile = async (file, req) => {
  if (!file) return null;

  const video = isVideo(file);
  let filePath = file.path;
  let mime = file.mimetype;
  let size = file.size;

  // Local optimize before upload (Cloudinary also optimizes on delivery)
  if (!video && isImage(file) && !isCloudinaryConfigured()) {
    filePath = await optimizeImage(filePath);
    mime = 'image/webp';
    try {
      size = fs.statSync(filePath).size;
    } catch (_) {}
  }

  if (isCloudinaryConfigured()) {
    try {
      const result = await cloudinaryUpload(filePath, {
        resource_type: video ? 'video' : 'image',
      });

      try {
        fs.unlinkSync(filePath);
      } catch (_) {}

      const base = {
        url: result.secure_url,
        publicId: result.public_id,
        provider: 'cloudinary',
        type: video ? 'video' : 'image',
        mime: result.format
          ? `${video ? 'video' : 'image'}/${result.format}`
          : mime,
        size: result.bytes || size,
        width: result.width,
        height: result.height,
        duration: result.duration,
        format: result.format,
      };

      if (!video && result.public_id) {
        const variants = buildImageVariants(result.public_id);
        base.variants = variants;
        base.url = variants.card || result.secure_url;
        base.urlDetail = variants.detail || result.secure_url;
        base.urlThumb = variants.thumb || result.secure_url;
        base.srcSet = variants.srcSet;
      }

      if (video && result.public_id) {
        const variants = buildVideoVariants(result.public_id);
        base.variants = variants;
        base.url = variants.detail || result.secure_url;
        base.urlPreview = variants.preview;
        base.urlTeaser = variants.teaser;
        base.poster = variants.poster;
        base.hls = variants.hls;
        base.duration = result.duration || base.duration;
      }

      return base;
    } catch (err) {
      console.error('Cloudinary upload failed, fallback local:', err.message);
    }
  }

  // Local fallback
  if (!video && isImage(file) && !filePath.endsWith('.webp')) {
    filePath = await optimizeImage(filePath);
    mime = 'image/webp';
  }

  const rel = path
    .relative(path.join(__dirname, '..'), filePath)
    .replace(/\\/g, '/');

  return {
    url: publicUrl(req, rel),
    filename: path.basename(filePath),
    provider: 'local',
    type: video ? 'video' : 'image',
    mime,
    size,
  };
};

export const processUploadedFiles = async (files, req) => {
  if (!files?.length) return [];
  const results = [];
  for (const file of files) {
    try {
      results.push(await processUploadedFile(file, req));
    } catch (err) {
      console.error('File process error:', err.message);
    }
  }
  return results.filter(Boolean);
};

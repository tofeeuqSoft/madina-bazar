import {
  processUploadedFile,
  processUploadedFiles,
  isCloudinaryConfigured,
  MEDIA_LIMITS,
} from '../utils/upload.js';

export const uploadSingle = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }
    const result = await processUploadedFile(req.file, req);
    res.status(200).json({
      success: true,
      message: `${result.type} uploaded`,
      data: result,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadMultiple = async (req, res) => {
  try {
    const files = req.files?.length
      ? req.files
      : req.files?.media || req.files?.images || [];
    // multer.array puts files on req.files as array
    const list = Array.isArray(req.files) ? req.files : files;
    if (!list?.length) {
      return res.status(400).json({ success: false, message: 'No files provided' });
    }

    const results = await processUploadedFiles(list, req);
    res.status(200).json({
      success: true,
      message: `${results.length} file(s) uploaded`,
      data: results,
      meta: {
        images: results.filter((r) => r.type === 'image').length,
        videos: results.filter((r) => r.type === 'video').length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadStatus = async (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      cloudinary: isCloudinaryConfigured(),
      local: true,
      imageMaxMB: MEDIA_LIMITS.imageMaxMB,
      videoMaxMB: MEDIA_LIMITS.videoMaxMB,
      maxFiles: MEDIA_LIMITS.maxFiles,
      imageFormats: MEDIA_LIMITS.imageFormats,
      videoFormats: MEDIA_LIMITS.videoFormats,
      optimize: true,
    },
  });
};

/**
 * Delete Cloudinary asset
 * @route DELETE /api/upload/cloudinary
 * body: { publicId, type: 'image'|'video' }
 */
export const deleteCloudinaryAsset = async (req, res) => {
  try {
    const { publicId, type = 'image' } = req.body;
    if (!publicId) {
      return res.status(400).json({ success: false, message: 'publicId required' });
    }

    const { isCloudinaryConfigured, cloudinaryDestroy } = await import(
      '../config/cloudinary.js'
    );

    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Cloudinary is not configured',
      });
    }

    const result = await cloudinaryDestroy(publicId, type);
    res.status(200).json({
      success: true,
      message: 'Asset deleted from Cloudinary',
      data: result,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

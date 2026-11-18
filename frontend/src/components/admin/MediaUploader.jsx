import { useState } from 'react';
import { Upload, X, Film, Image as ImageIcon, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadMedia } from '../../services/uploadService';

/**
 * Multi image + video uploader with preview
 * onChange(urls: string[]) — image URLs for product.images
 * onVideosChange?.(videos: {url}[])
 */
export default function MediaUploader({
  images = [],
  videos = [],
  onImagesChange,
  onVideosChange,
  maxFiles = 12,
}) {
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    if (files.length > maxFiles) {
      toast.error(`Max ${maxFiles} files at once`);
      return;
    }

    setUploading(true);
    try {
      const res = await uploadMedia(files);
      const list = res.data || [];
      const newImages = list.filter((x) => x.type === 'image').map((x) => x.url);
      const newVideos = list.filter((x) => x.type === 'video');

      if (newImages.length) {
        onImagesChange?.([...images, ...newImages]);
      }
      if (newVideos.length && onVideosChange) {
        onVideosChange([...videos, ...newVideos]);
      }

      toast.success(
        `${list.length} uploaded (${res.meta?.images || 0} img, ${res.meta?.videos || 0} video)`
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (idx) => {
    onImagesChange?.(images.filter((_, i) => i !== idx));
  };

  const removeVideo = (idx) => {
    onVideosChange?.(videos.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium mb-1">Media (Images & Videos)</label>

      <label
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition
          border-primary-200 dark:border-primary-800 hover:border-primary-500 hover:bg-primary-50/50 dark:hover:bg-primary-900/20
          ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        {uploading ? (
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        ) : (
          <Upload className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        )}
        <span className="text-sm font-medium text-primary-800 dark:text-primary-200">
          {uploading ? 'Uploading & optimizing…' : 'Click to upload images / videos'}
        </span>
        <span className="text-xs text-gray-500">
          JPG, PNG, WebP, GIF · MP4, WebM, MOV · Images auto-compressed to WebP
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={handleFiles}
        />
      </label>

      {images.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5" /> Images ({images.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {images.map((url, i) => (
              <div key={i} className="relative group w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-primary-100 dark:border-primary-800">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full opacity-90 hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
            <Film className="w-3.5 h-3.5" /> Videos ({videos.length})
          </p>
          <div className="space-y-2">
            {videos.map((v, i) => (
              <div key={i} className="flex items-center gap-2 card p-2">
                <video src={v.url} className="w-24 h-14 object-cover rounded bg-black" muted />
                <span className="text-xs flex-1 truncate text-gray-500">{v.url}</span>
                <button type="button" onClick={() => removeVideo(i)} className="p-1 text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

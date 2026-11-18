import api from './api';

/**
 * Upload single file (image or video)
 * @param {File} file
 * @param {'file'|'image'|'video'|'avatar'} field
 */
export const uploadFile = async (file, field = 'file') => {
  const formData = new FormData();
  formData.append(field, file);
  const endpoint =
    field === 'image'
      ? '/upload/image'
      : field === 'video'
        ? '/upload/video'
        : field === 'avatar'
          ? '/upload/avatar'
          : '/upload';
  const { data } = await api.post(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return data.data;
};

/** @deprecated use uploadFile */
export const uploadImage = (file) => uploadFile(file, 'image');

/**
 * Upload multiple images/videos
 * @param {FileList|File[]} files
 */
export const uploadMedia = async (files) => {
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append('files', file));
  const { data } = await api.post('/upload/multiple', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,
  });
  return data;
};

/** @deprecated */
export const uploadImages = async (files) => {
  const res = await uploadMedia(files);
  return res.data;
};

export const getUploadStatus = async () => {
  const { data } = await api.get('/upload/status');
  return data.data;
};

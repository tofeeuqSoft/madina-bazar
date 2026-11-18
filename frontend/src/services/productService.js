import api from './api';

export const getProducts = async (params = {}) => {
  const { data } = await api.get('/products', { params });
  return data;
};

export const getProduct = async (idOrSlug) => {
  const { data } = await api.get(`/products/${idOrSlug}`);
  return data;
};

export const getCategories = async (params = {}) => {
  const { data } = await api.get('/categories', { params });
  return data;
};

export const getCategoryTree = async () => {
  const { data } = await api.get('/categories/tree');
  return data;
};

export const getCombos = async (params = {}) => {
  const { data } = await api.get('/combos', { params });
  return data;
};

export const getProductReviews = async (productId, params = {}) => {
  const { data } = await api.get(`/reviews/product/${productId}`, { params });
  return data;
};

export const submitReview = async ({ productId, rating, comment }) => {
  const { data } = await api.post('/reviews', { productId, rating, comment });
  return data;
};

export const deleteReview = async (reviewId) => {
  const { data } = await api.delete(`/reviews/${reviewId}`);
  return data;
};

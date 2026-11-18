import api from './api';

export const marketingApi = {
  dashboard: (params) => api.get('/admin/marketing/dashboard', { params }).then((r) => r.data.data),
  sales: (params) => api.get('/admin/marketing/sales', { params }).then((r) => r.data.data),
  products: (params) => api.get('/admin/marketing/products', { params }).then((r) => r.data.data),
  rfm: () => api.get('/admin/marketing/rfm').then((r) => r.data.data),
  geo: () => api.get('/admin/marketing/geo').then((r) => r.data.data),
  coupons: () => api.get('/admin/marketing/coupons').then((r) => r.data.data),
  retention: () => api.get('/admin/marketing/retention').then((r) => r.data.data),
  growth: () => api.get('/admin/marketing/growth').then((r) => r.data.data),
  quality: () => api.get('/admin/marketing/quality').then((r) => r.data.data),
};

export default marketingApi;

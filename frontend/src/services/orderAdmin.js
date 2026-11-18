import api from './api';

export const orderAdminApi = {
  dashboard: () => api.get('/admin/orders/dashboard').then((r) => r.data.data),
  list: (params) => api.get('/admin/orders', { params }).then((r) => r.data),
  byStatus: (status, params) => api.get(`/admin/orders/status/${status}`, { params }).then((r) => r.data),
  detail: (id) => api.get(`/admin/orders/${id}`).then((r) => r.data.data),
  setStatus: (id, body) => api.patch(`/admin/orders/${id}/status`, body).then((r) => r.data.data),
  setPriority: (id, body) => api.patch(`/admin/orders/${id}/priority`, body).then((r) => r.data.data),
  editCustomer: (id, body) => api.patch(`/admin/orders/${id}/customer`, body).then((r) => r.data.data),
  editAddress: (id, body) => api.patch(`/admin/orders/${id}/address`, body).then((r) => r.data.data),
  assign: (id, body) => api.post(`/admin/orders/${id}/assign`, body).then((r) => r.data.data),
  unassign: (id) => api.delete(`/admin/orders/${id}/assign`).then((r) => r.data.data),
  hold: (id, body) => api.post(`/admin/orders/${id}/hold`, body).then((r) => r.data.data),
  cancel: (id, body) => api.post(`/admin/orders/${id}/cancel`, body).then((r) => r.data.data),
  reopen: (id, body) => api.post(`/admin/orders/${id}/reopen`, body || {}).then((r) => r.data.data),
  refundRequest: (id, body) => api.post(`/admin/orders/${id}/refund-request`, body).then((r) => r.data.data),
  notes: (id) => api.get(`/admin/orders/${id}/notes`).then((r) => r.data.data),
  addNote: (id, body) => api.post(`/admin/orders/${id}/notes`, body).then((r) => r.data.data),
  timeline: (id) => api.get(`/admin/orders/${id}/timeline`).then((r) => r.data.data),
  communicate: (id, body) => api.post(`/admin/orders/${id}/communication`, body).then((r) => r.data.data),
  agents: () => api.get('/admin/orders/agents').then((r) => r.data.data),
  bulk: (body) => api.post('/admin/orders/bulk', body).then((r) => r.data.data),
  reports: (params) => api.get('/admin/orders/reports', { params }).then((r) => r.data.data),
  audit: (params) => api.get('/admin/orders/audit-logs', { params }).then((r) => r.data.data),
};

export default orderAdminApi;

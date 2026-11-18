import api from './api';

const get = (path, params = {}) => api.get(`/reports/${path}`, { params }).then((r) => r.data);

export const reportService = {
  summary: (p) => get('summary', p),
  sales: (p) => get('sales', p),
  purchases: (p) => get('purchases', p),
  expenses: (p) => get('expenses', p),
  profitLoss: (p) => get('profit-loss', p),
  balanceSheet: (p) => get('balance-sheet', p),
  cashFlow: (p) => get('cash-flow', p),
  customerDue: () => get('customer-due'),
  supplierDue: () => get('supplier-due'),
  payments: (p) => get('payments', p),
  refunds: (p) => get('refunds', p),
  returns: (p) => get('returns', p),
  tax: (p) => get('tax', p),
  inventory: (p) => get('inventory-valuation', p),
  cogs: (p) => get('cogs', p),
  grossProfit: (p) => get('gross-profit', p),
  netProfit: (p) => get('net-profit', p),
};

export const financeService = {
  suppliers: {
    list: (p) => api.get('/suppliers', { params: p }).then((r) => r.data),
    create: (d) => api.post('/suppliers', d).then((r) => r.data),
  },
  purchases: {
    list: (p) => api.get('/purchases', { params: p }).then((r) => r.data),
    create: (d) => api.post('/purchases', d).then((r) => r.data),
    pay: (id, d) => api.patch(`/purchases/${id}/payment`, d).then((r) => r.data),
  },
  expenses: {
    list: (p) => api.get('/expenses', { params: p }).then((r) => r.data),
    create: (d) => api.post('/expenses', d).then((r) => r.data),
    remove: (id) => api.delete(`/expenses/${id}`).then((r) => r.data),
  },
  returns: {
    list: (p) => api.get('/returns', { params: p }).then((r) => r.data),
    create: (d) => api.post('/returns', d).then((r) => r.data),
    setStatus: (id, d) => api.patch(`/returns/${id}/status`, d).then((r) => r.data),
  },
};

export default reportService;

import api from './axios'

export const getInvoices = (params) => api.get('/invoices', { params })
export const getInvoiceById = (id) => api.get(`/invoices/${id}`)
export const createInvoice = (data) => api.post('/invoices', data)
export const updateInvoice = (id, data) => api.put(`/invoices/${id}`, data)
export const deleteInvoice = (id) => api.delete(`/invoices/${id}`)

// Actions
export const generateInvoiceFromSub = (subId, data = {}) => api.post(`/invoices/generate/${subId}`, data)
export const confirmInvoice = (id) => api.post(`/invoices/${id}/confirm`)
export const cancelInvoice = (id) => api.post(`/invoices/${id}/cancel`)
export const applyDiscount = (id, data) => api.post(`/invoices/${id}/apply-discount`, data)

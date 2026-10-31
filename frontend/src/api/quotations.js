import api from './axios'

export const getQuotations = (params) => api.get('/quotations', { params })
export const getQuotationById = (id) => api.get(`/quotations/${id}`)
export const createQuotation = (data) => api.post('/quotations', data)
export const updateQuotation = (id, data) => api.put(`/quotations/${id}`, data)
export const deleteQuotation = (id) => api.delete(`/quotations/${id}`)

// Actions
export const sendQuotation = (id) => api.post(`/quotations/${id}/send`)
export const acceptQuotation = (id) => api.post(`/quotations/${id}/accept`)
export const rejectQuotation = (id) => api.post(`/quotations/${id}/reject`)

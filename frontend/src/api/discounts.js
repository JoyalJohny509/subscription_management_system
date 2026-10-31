import api from './axios'

export const getDiscounts = (params) => api.get('/discounts', { params })
export const getDiscountById = (id) => api.get(`/discounts/${id}`)
export const createDiscount = (data) => api.post('/discounts', data)
export const updateDiscount = (id, data) => api.put(`/discounts/${id}`, data)
export const deleteDiscount = (id) => api.delete(`/discounts/${id}`)

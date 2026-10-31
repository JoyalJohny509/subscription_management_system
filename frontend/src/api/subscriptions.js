import api from './axios'

export const getSubscriptions = (params) => api.get('/subscriptions', { params })
export const getSubscriptionById = (id) => api.get(`/subscriptions/${id}`)
export const createSubscription = (data) => api.post('/subscriptions', data)
export const updateSubscription = (id, data) => api.put(`/subscriptions/${id}`, data)
export const deleteSubscription = (id) => api.delete(`/subscriptions/${id}`)

// Actions
export const activateSubscription = (id) => api.post(`/subscriptions/${id}/activate`)
export const confirmSubscription = (id) => api.post(`/subscriptions/${id}/confirm`)
export const pauseSubscription = (id) => api.post(`/subscriptions/${id}/pause`)
export const closeSubscription = (id) => api.post(`/subscriptions/${id}/close`)
export const generateInvoice = (id) => api.post(`/subscriptions/${id}/generate-invoice`)

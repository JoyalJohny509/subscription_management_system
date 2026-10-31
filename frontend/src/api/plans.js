import api from './axios'

export const getPlans = (params) => api.get('/plans', { params })
export const getPlanById = (id) => api.get(`/plans/${id}`)
export const createPlan = (data) => api.post('/plans', data)
export const updatePlan = (id, data) => api.put(`/plans/${id}`, data)
export const deletePlan = (id) => api.delete(`/plans/${id}`)

import api from './axios'

export const getSummary = () => api.get('/dashboard/summary')
export const getRevenueReport = (params) => api.get('/dashboard/revenue', { params })
export const getSubscriptionsReport = (params) => api.get('/dashboard/subscriptions', { params })
export const getOverdueReport = (params) => api.get('/dashboard/overdue', { params })

import api from './axios'

export const getUsers = (params) => api.get('/users', { params })
export const getUserById = (id) => api.get(`/users/${id}`)
export const createUser = (data) => api.post('/users', data)
export const updateUser = (id, data) => api.put(`/users/${id}`, data)
export const deleteUser = (id) => api.delete(`/users/${id}`)
export const getMyProfile = () => api.get('/users/me')

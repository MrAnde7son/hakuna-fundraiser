import api from './client'

export const fetchDomains = () =>
  api.get('/api/domains').then((r) => r.data)

export const createDomain = (data) =>
  api.post('/api/domains', data).then((r) => r.data)

export const updateDomain = (id, data) =>
  api.put(`/api/domains/${id}`, data).then((r) => r.data)

export const deleteDomain = (id) =>
  api.delete(`/api/domains/${id}`)

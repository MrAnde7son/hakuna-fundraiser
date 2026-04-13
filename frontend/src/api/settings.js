import api from './client'

export const fetchSettings = () =>
  api.get('/api/settings').then((r) => r.data)

export const updateSettings = (values) =>
  api.put('/api/settings', { values }).then((r) => r.data)

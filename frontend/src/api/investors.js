import api from './client'

export const fetchInvestors = (params) =>
  api.get('/api/investors', { params }).then((r) => r.data)

export const fetchInvestor = (id) =>
  api.get(`/api/investors/${id}`).then((r) => r.data)

export const createInvestor = (data) =>
  api.post('/api/investors', data).then((r) => r.data)

export const deleteInvestor = (id) =>
  api.delete(`/api/investors/${id}`)

export const triggerEnrichment = (id) =>
  api.post(`/api/investors/${id}/enrich`).then((r) => r.data)

export const fetchPartners = (id) =>
  api.get(`/api/investors/${id}/partners`).then((r) => r.data)

export const fetchPortfolio = (id) =>
  api.get(`/api/investors/${id}/portfolio`).then((r) => r.data)

export const fetchOutreach = (id) =>
  api.get(`/api/investors/${id}/outreach`).then((r) => r.data)

export const createOutreachNote = (id, data) =>
  api.post(`/api/investors/${id}/outreach`, data).then((r) => r.data)

export const fetchJobs = (id) =>
  api.get(`/api/investors/${id}/jobs`).then((r) => r.data)

export const fetchDomainConflicts = () =>
  api.get('/api/investors/strategy/matrix').then((r) => r.data)

export const importCSV = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/api/investors/import/csv', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data)
}

export const seedInvestors = () =>
  api.post('/api/seed').then((r) => r.data)

export const enrichAll = () =>
  api.post('/api/investors/enrich-all').then((r) => r.data)

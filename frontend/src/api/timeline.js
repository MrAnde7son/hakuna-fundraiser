import api from './client'

export const fetchTimeline = (params) =>
  api.get('/api/timeline', { params }).then((r) => r.data)

export const fetchTimelineDomains = () =>
  api.get('/api/timeline/domains').then((r) => r.data)

export const fetchTimelineStats = () =>
  api.get('/api/timeline/stats').then((r) => r.data)

export const fetchInvestorEvents = (investorId) =>
  api.get(`/api/investors/${investorId}/events`).then((r) => r.data)

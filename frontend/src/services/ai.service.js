import API from './apiClient'

export const getAiStatus = () => API.get('/ai/status')
export const configureAiLlm = (geminiApiKey) => API.post('/ai/configure', { geminiApiKey })
export const getAiCapabilities = () => API.get('/ai/capabilities')
export const getAiDashboardStats = () => API.get('/ai/dashboard-stats')
export const getAiSessions = () => API.get('/ai/sessions')
export const getAiSession = (id) => API.get(`/ai/sessions/${id}`)
export const deleteAiSession = (id) => API.delete(`/ai/sessions/${id}`)
export const sendAiMessage = (data) => API.post('/ai/chat', data)
export const getAiReports = () => API.get('/ai/reports')
export const getAiReport = (id) => API.get(`/ai/reports/${id}`)
export const deleteAiReport = (id) => API.delete(`/ai/reports/${id}`)
export const generateAiReport = (reportType) => API.post('/ai/reports/generate', { reportType })

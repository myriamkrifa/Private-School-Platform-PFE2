import axios from 'axios'

/**
 * In dev, Vite proxies /api → http://localhost:5000 (see vite.config.js).
 * Set VITE_API_URL in production to your deployed API origin + /api.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '/api' : 'http://localhost:5000/api')

const API = axios.create({ baseURL: API_BASE_URL })

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default API

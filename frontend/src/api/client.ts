import axios from 'axios'
import { useAuth } from '../stores/auth'

export const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = useAuth.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      useAuth.getState().logout()
      if (location.pathname !== '/login') location.assign('/login')
    }
    return Promise.reject(error)
  },
)

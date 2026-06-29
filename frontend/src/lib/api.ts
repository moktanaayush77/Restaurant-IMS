import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { AuthTokens } from '../types'

const ACCESS_KEY = 'rms.access'
const REFRESH_KEY = 'rms.refresh'

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  set(tokens: AuthTokens) {
    localStorage.setItem(ACCESS_KEY, tokens.access)
    localStorage.setItem(REFRESH_KEY, tokens.refresh)
  },
  setAccess(access: string) {
    localStorage.setItem(ACCESS_KEY, access)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

// Local dev: '/api' (Vite proxies to the backend). Production (Vercel): set
// VITE_API_URL to the Render backend, e.g. https://<backend>.onrender.com/api.
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api' })

// Attach the access token to every request.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.access
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On a 401, try a one-shot refresh, then replay the original request.
let refreshing: Promise<string | null> | null = null

async function refreshAccess(): Promise<string | null> {
  const refresh = tokenStore.refresh
  if (!refresh) return null
  try {
    const { data } = await axios.post('/api/auth/refresh/', { refresh })
    tokenStore.setAccess(data.access)
    return data.access as string
  } catch {
    tokenStore.clear()
    return null
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean }
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true
      refreshing = refreshing ?? refreshAccess()
      const newAccess = await refreshing
      refreshing = null
      if (newAccess) {
        original.headers.Authorization = `Bearer ${newAccess}`
        return api(original)
      }
    }
    return Promise.reject(error)
  },
)

/** Pull a human-readable message out of a DRF error response. */
export function apiError(err: unknown, fallback = 'Something went wrong.'): string {
  const e = err as AxiosError<Record<string, unknown>>
  const data = e?.response?.data
  if (!data) return fallback
  if (typeof data === 'string') return data
  const first = Object.values(data)[0]
  if (Array.isArray(first)) return String(first[0])
  if (typeof first === 'string') return first
  return fallback
}

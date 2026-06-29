import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, tokenStore } from '../../lib/api'
import type { LoginResponse, User } from '../../types'

type Status = 'loading' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  user: User | null
  status: Status
  login: (username: string, password: string) => Promise<User>
  pinLogin: (username: string, pin: string) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  // Validate any stored token on first load.
  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      if (!tokenStore.access) {
        setStatus('anonymous')
        return
      }
      try {
        const { data } = await api.get<User>('/auth/me/')
        if (!cancelled) {
          setUser(data)
          setStatus('authenticated')
        }
      } catch {
        tokenStore.clear()
        if (!cancelled) setStatus('anonymous')
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const finish = useCallback((data: LoginResponse) => {
    tokenStore.set(data.tokens)
    setUser(data.user)
    setStatus('authenticated')
    return data.user
  }, [])

  const login = useCallback(
    async (username: string, password: string) => {
      const { data } = await api.post<LoginResponse>('/auth/login/', { username, password })
      return finish(data)
    },
    [finish],
  )

  const pinLogin = useCallback(
    async (username: string, pin: string) => {
      const { data } = await api.post<LoginResponse>('/auth/pin-login/', { username, pin })
      return finish(data)
    },
    [finish],
  )

  const logout = useCallback(() => {
    // Best-effort server-side revoke (blacklist the refresh token), then clear.
    const refresh = tokenStore.refresh
    if (refresh) api.post('/auth/logout/', { refresh }).catch(() => {})
    tokenStore.clear()
    setUser(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo(
    () => ({ user, status, login, pinLogin, logout }),
    [user, status, login, pinLogin, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** Default landing path for a role. */
export function homePathForRole(role: User['role']): string {
  switch (role) {
    case 'ADMIN':
      return '/admin'
    case 'ACCOUNTANT':
      return '/admin/billing'
    case 'CHEF':
      return '/kitchen'
    default:
      return '/waiter'
  }
}

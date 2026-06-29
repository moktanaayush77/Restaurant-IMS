import { Navigate, Outlet } from 'react-router-dom'
import { FullPageSpinner } from '../../components/ui/Spinner'
import type { Role } from '../../types'
import { homePathForRole, useAuth } from './AuthContext'

/** Guards a route subtree by authentication and (optionally) allowed roles. */
export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, status } = useAuth()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'anonymous' || !user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePathForRole(user.role)} replace />
  }
  return <Outlet />
}

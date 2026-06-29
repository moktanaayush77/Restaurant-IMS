import { Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useBranding } from '../settings/useBranding'
import { useAuth } from '../auth/AuthContext'

export function WaiterLayout() {
  const { data: branding } = useBranding()
  const { user, logout } = useAuth()
  const name = branding?.name ?? 'Restaurant'

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-200 bg-surface/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-clay-600 font-display text-lg font-semibold text-clay-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
            {name.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="font-display text-[0.95rem] font-semibold leading-tight text-ink-900">
              {name}
            </p>
            <p className="eyebrow mt-0.5">Waiter station</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-ink-900">{user?.display_name}</p>
            <p className="eyebrow mt-0.5">Waiter</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="grid h-10 w-10 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}

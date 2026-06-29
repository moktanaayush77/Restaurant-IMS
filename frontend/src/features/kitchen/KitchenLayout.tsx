import { Outlet } from 'react-router-dom'
import { ChefHat, LogOut } from 'lucide-react'
import { useBranding } from '../settings/useBranding'
import { useAuth } from '../auth/AuthContext'

/**
 * The KDS is the warm dark counterpart to the cream front-of-house: an espresso
 * "chalkboard" tuned for high-contrast legibility across a busy, bright kitchen.
 */
export function KitchenLayout() {
  const { data: branding } = useBranding()
  const { user, logout } = useAuth()
  const name = branding?.name ?? 'Restaurant'

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-ink-100">
      <header className="flex items-center justify-between border-b border-clay-200/10 bg-gradient-to-b from-white/[0.04] to-transparent px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-clay-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
            <ChefHat className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-[0.95rem] font-semibold leading-tight text-white">
              {name}
            </p>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-brass-300">
              The Pass · Kitchen Display
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-ink-300">{user?.display_name}</span>
          <button
            onClick={logout}
            title="Sign out"
            className="grid h-10 w-10 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-white/10 hover:text-danger-500"
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

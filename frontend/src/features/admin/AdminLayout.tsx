import { NavLink, Outlet } from 'react-router-dom'
import {
  Boxes,
  ClipboardList,
  LayoutGrid,
  LogOut,
  Receipt,
  Settings,
  Soup,
  Table2,
  UsersRound,
} from 'lucide-react'
import { useBranding } from '../settings/useBranding'
import { useAuth } from '../auth/AuthContext'
import { cn } from '../../lib/cn'

import type { Role } from '../../types'

const NAV: { to: string; end?: boolean; label: string; icon: typeof LayoutGrid; roles: Role[] }[] = [
  { to: '/admin', end: true, label: 'Reception', icon: LayoutGrid, roles: ['ADMIN'] },
  { to: '/admin/tables', label: 'Tables', icon: Table2, roles: ['ADMIN'] },
  { to: '/admin/menu', label: 'Menu', icon: Soup, roles: ['ADMIN'] },
  { to: '/admin/staff', label: 'Staff', icon: UsersRound, roles: ['ADMIN'] },
  { to: '/admin/billing', label: 'Billing', icon: Receipt, roles: ['ADMIN', 'ACCOUNTANT'] },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes, roles: ['ADMIN', 'ACCOUNTANT'] },
  { to: '/admin/reports', label: 'Reports', icon: ClipboardList, roles: ['ADMIN', 'ACCOUNTANT'] },
  { to: '/admin/settings', label: 'Settings', icon: Settings, roles: ['ADMIN'] },
]

export function AdminLayout() {
  const { data: branding } = useBranding()
  const { user, logout } = useAuth()
  const name = branding?.name ?? 'Restaurant'
  const isAccountant = user?.role === 'ACCOUNTANT'
  const areaLabel = isAccountant ? 'Accounts' : 'Reception'
  const roleLabel = isAccountant ? 'Accountant' : 'Administrator'
  const nav = NAV.filter((n) => user && n.roles.includes(user.role))

  return (
    <div className="flex min-h-screen bg-ink-50">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-200 bg-surface md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-clay-600 font-display text-lg font-semibold text-clay-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
            {name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-[0.95rem] font-semibold leading-tight text-ink-900">
              {name}
            </p>
            <p className="eyebrow mt-0.5">{areaLabel}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {nav.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-clay-50 text-clay-700'
                    : 'text-ink-600 hover:bg-ink-100/70 hover:text-ink-900',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-clay-500" />
                  )}
                  <Icon
                    className={cn(
                      'h-[1.15rem] w-[1.15rem] transition-colors',
                      isActive ? 'text-clay-500' : 'text-ink-400 group-hover:text-ink-600',
                    )}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-ink-200 p-3">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-ink-100 font-display text-sm font-semibold text-ink-700 ring-1 ring-inset ring-ink-200">
              {(user?.display_name ?? '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">{user?.display_name}</p>
              <p className="eyebrow mt-0.5">{roleLabel}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
            >
              <LogOut className="h-[1.15rem] w-[1.15rem]" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  )
}

import { Navigate, Route, Routes } from 'react-router-dom'
import { BillingPage } from './features/admin/BillingPage'
import { InventoryPage } from './features/admin/InventoryPage'
import { ReportsPage } from './features/admin/ReportsPage'
import { SettingsPage } from './features/admin/SettingsPage'

import { FullPageSpinner } from './components/ui/Spinner'
import { homePathForRole, useAuth } from './features/auth/AuthContext'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { LoginPage } from './features/auth/LoginPage'
import { AdminLayout } from './features/admin/AdminLayout'
import { AdminHome } from './features/admin/AdminHome'
import { TablesPage } from './features/admin/TablesPage'
import { MenuPage } from './features/admin/MenuPage'
import { StaffPage } from './features/admin/StaffPage'
import { WaiterLayout } from './features/waiter/WaiterLayout'
import { WaiterHome } from './features/waiter/WaiterHome'
import { OrderScreen } from './features/waiter/OrderScreen'
import { KitchenLayout } from './features/kitchen/KitchenLayout'
import { KitchenHome } from './features/kitchen/KitchenHome'

function RootRedirect() {
  const { status, user } = useAuth()
  if (status === 'loading') return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={homePathForRole(user.role)} replace />
}

function LoginRoute() {
  const { status, user } = useAuth()
  if (status === 'loading') return <FullPageSpinner />
  if (user) return <Navigate to={homePathForRole(user.role)} replace />
  return <LoginPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginRoute />} />

      {/* Admin / Reception + Accountant (accountant gets billing/reports/inventory) */}
      <Route element={<ProtectedRoute roles={['ADMIN', 'ACCOUNTANT']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          {/* Shared with the accountant */}
          <Route path="billing" element={<BillingPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          {/* Admin-only */}
          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route index element={<AdminHome />} />
            <Route path="tables" element={<TablesPage />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>

      {/* Waiter */}
      <Route element={<ProtectedRoute roles={['WAITER']} />}>
        <Route path="/waiter" element={<WaiterLayout />}>
          <Route index element={<WaiterHome />} />
          <Route path="table/:tableId" element={<OrderScreen />} />
        </Route>
      </Route>

      {/* Kitchen */}
      <Route element={<ProtectedRoute roles={['CHEF']} />}>
        <Route path="/kitchen" element={<KitchenLayout />}>
          <Route index element={<KitchenHome />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

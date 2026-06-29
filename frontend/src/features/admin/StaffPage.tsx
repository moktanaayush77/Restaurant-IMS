import { useState } from 'react'
import { Calculator, ChefHat, KeyRound, Pencil, Plus, UserRound, UsersRound } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState } from '../../components/EmptyState'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Switch } from '../../components/ui/Switch'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/toast'
import { apiError } from '../../lib/api'
import type { Staff } from '../../types'
import { useResetPin, useSaveStaff, useStaff } from './hooks'

export function StaffPage() {
  const { data: staff, isLoading } = useStaff()
  const [editing, setEditing] = useState<Partial<Staff> | null>(null)
  const [pinFor, setPinFor] = useState<Staff | null>(null)

  return (
    <>
      <PageHeader
        eyebrow="Team"
        title="Staff"
        subtitle="Waiters, chefs and accountants — manage accounts and logins"
        actions={
          <Button onClick={() => setEditing({})}>
            <Plus className="h-4 w-4" /> Add staff
          </Button>
        }
      />
      <div className="px-6 py-6 md:px-8">
        {isLoading ? (
          <div className="grid place-items-center py-20">
            <Spinner className="h-7 w-7 text-clay-500" />
          </div>
        ) : !staff?.length ? (
          <EmptyState
            icon={UsersRound}
            title="No staff yet"
            description="Add waiters and chefs so they can log in on their tablets."
            action={
              <Button onClick={() => setEditing({})}>
                <Plus className="h-4 w-4" /> Add staff
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-card border border-ink-200 bg-surface shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="eyebrow border-b border-ink-200 bg-surface-sunk/60 text-left text-ink-400">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Username</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Login</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {staff.map((s) => (
                  <tr key={s.id} className={s.is_active ? '' : 'opacity-55'}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-ink-100 font-display text-ink-600">
                          {s.role === 'CHEF' ? (
                            <ChefHat className="h-4.5 w-4.5" />
                          ) : s.role === 'ACCOUNTANT' ? (
                            <Calculator className="h-4.5 w-4.5" />
                          ) : (
                            <UserRound className="h-4.5 w-4.5" />
                          )}
                        </div>
                        <span className="font-medium text-ink-900">{s.display_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-500">{s.username}</td>
                    <td className="px-5 py-3">
                      <Badge tone={s.role === 'CHEF' ? 'warn' : s.role === 'ACCOUNTANT' ? 'clay' : 'olive'}>
                        {s.role === 'CHEF' ? 'Chef' : s.role === 'ACCOUNTANT' ? 'Accountant' : 'Waiter'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.has_pin && <Badge tone="neutral" className="nums">PIN</Badge>}
                        {s.has_password && <Badge tone="clay">Password</Badge>}
                        {!s.has_pin && !s.has_password && <Badge tone="warn">Not set</Badge>}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={s.is_active ? 'success' : 'neutral'}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        {s.role !== 'ACCOUNTANT' && (
                          <button
                            title="Reset PIN"
                            onClick={() => setPinFor(s)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          title="Edit"
                          onClick={() => setEditing(s)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <StaffForm staff={editing} onClose={() => setEditing(null)} />}
      {pinFor && <ResetPinModal staff={pinFor} onClose={() => setPinFor(null)} />}
    </>
  )
}

function StaffForm({ staff, onClose }: { staff: Partial<Staff>; onClose: () => void }) {
  const save = useSaveStaff()
  const toast = useToast()
  const isNew = !staff.id
  const [form, setForm] = useState({
    username: staff.username ?? '',
    first_name: staff.first_name ?? '',
    last_name: staff.last_name ?? '',
    phone: staff.phone ?? '',
    role: staff.role ?? 'WAITER',
    is_active: staff.is_active ?? true,
    pin: '',
    password: '',
  })
  const [error, setError] = useState('')

  const isAccountant = form.role === 'ACCOUNTANT'

  async function submit() {
    if (!form.username.trim()) return setError('Username is required.')
    if (isAccountant) {
      if (isNew && !form.password) return setError('Accountants sign in with a password.')
    } else if (isNew && !form.pin && !form.password) {
      return setError('Set a PIN, a password, or both.')
    }
    if (form.pin && !/^\d{4,6}$/.test(form.pin)) return setError('PIN must be 4–6 digits.')
    if (form.password && form.password.length < 8)
      return setError('Password must be at least 8 characters.')
    try {
      const payload: Record<string, unknown> = {
        id: staff.id,
        username: form.username.trim(),
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        role: form.role,
        is_active: form.is_active,
      }
      if (form.pin) payload.pin = form.pin
      if (form.password) payload.password = form.password
      await save.mutateAsync(payload)
      toast(isNew ? 'Staff added.' : 'Staff updated.')
      onClose()
    } catch (e) {
      setError(apiError(e))
    }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Add staff' : 'Edit staff'}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First name"
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
          />
          <Input
            label="Last name"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
          />
        </div>
        <Input
          label="Username"
          hint="Used to log in on the tablet"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Staff['role'] })}
          >
            <option value="WAITER">Waiter</option>
            <option value="CHEF">Chef</option>
            <option value="ACCOUNTANT">Accountant</option>
          </Select>
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className={isAccountant ? '' : 'grid grid-cols-2 gap-4'}>
          {!isAccountant && (
            <Input
              label={isNew ? 'PIN (4–6 digits)' : 'New PIN'}
              hint="Fast tablet login"
              inputMode="numeric"
              maxLength={6}
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
            />
          )}
          <Input
            label={isNew ? (isAccountant ? 'Password' : 'Password (optional)') : 'New password'}
            type="password"
            autoComplete="new-password"
            hint={isAccountant ? 'Min 8 characters — accountants sign in with a password' : 'For password sign-in'}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        {!isNew && (
          <p className="text-xs text-ink-500">Leave PIN and password blank to keep the current ones.</p>
        )}
        {error && <p className="text-sm text-danger-600">{error}</p>}
        {!isNew && (
          <Switch
            checked={form.is_active}
            onChange={(v) => setForm({ ...form, is_active: v })}
            label="Active"
          />
        )}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} loading={save.isPending}>
          {isNew ? 'Add staff' : 'Save changes'}
        </Button>
      </div>
    </Modal>
  )
}

function ResetPinModal({ staff, onClose }: { staff: Staff; onClose: () => void }) {
  const reset = useResetPin()
  const toast = useToast()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  async function submit() {
    if (!/^\d{4,6}$/.test(pin)) return setError('PIN must be 4–6 digits.')
    try {
      await reset.mutateAsync({ id: staff.id, pin })
      toast(`PIN updated for ${staff.display_name}.`)
      onClose()
    } catch (e) {
      setError(apiError(e))
    }
  }

  return (
    <Modal open onClose={onClose} title="Reset PIN" description={staff.display_name} size="sm">
      <Input
        label="New PIN (4–6 digits)"
        inputMode="numeric"
        maxLength={6}
        autoFocus
        value={pin}
        error={error}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
      />
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} loading={reset.isPending}>
          Update PIN
        </Button>
      </div>
    </Modal>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Delete, KeyRound, User as UserIcon } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { apiError } from '../../lib/api'
import { useBranding } from '../settings/useBranding'
import { homePathForRole, useAuth } from './AuthContext'

type Mode = 'staff' | 'admin'

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('staff')
  const { data: branding } = useBranding()
  const name = branding?.name ?? 'Restaurant'

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-10">
      {/* Oversized serif watermark — a menu-cover flourish, not a dot grid */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 bottom-[-6rem] select-none font-display text-[28rem] leading-none text-clay-500/[0.05]"
      >
        &amp;
      </span>

      <div className="relative w-full max-w-sm">
        {/* Brand — set like a fine-dining menu cover */}
        <div className="mb-8 text-center">
          <p className="eyebrow mb-3 text-clay-600">In-house service · Est.</p>
          <h1 className="font-display text-[2.6rem] font-semibold leading-[1.05] text-ink-900">
            {name}
          </h1>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="h-px w-12 bg-ink-300" />
            <span className="h-1.5 w-1.5 rotate-45 bg-clay-500" />
            <span className="h-px w-12 bg-ink-300" />
          </div>
          <p className="mt-3 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-500">
            Point of Sale
          </p>
        </div>

        {/* Sign-in card */}
        <div className="rounded-card border border-ink-200 bg-surface p-6 shadow-card sm:p-7">
          <h2 className="font-display text-xl font-semibold text-ink-900">Sign in</h2>
          <p className="mt-0.5 text-sm text-ink-500">Welcome back. Choose how you sign in.</p>

          <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-surface-sunk p-1">
            <TabButton active={mode === 'staff'} onClick={() => setMode('staff')}>
              Staff PIN
            </TabButton>
            <TabButton active={mode === 'admin'} onClick={() => setMode('admin')}>
              Password
            </TabButton>
          </div>

          <div className="mt-6">{mode === 'staff' ? <StaffForm /> : <AdminForm />}</div>
        </div>

        <p className="mt-6 text-center text-xs text-ink-400">
          {branding?.address || 'In-house restaurant management'}
        </p>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'h-9 rounded-md text-sm font-medium transition-colors ' +
        (active
          ? 'bg-surface-raised text-ink-900 shadow-card ring-1 ring-inset ring-ink-200'
          : 'text-ink-500 hover:text-ink-700')
      }
    >
      {children}
    </button>
  )
}

function AdminForm() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(username.trim(), password)
      navigate(homePathForRole(user.role), { replace: true })
    } catch (err) {
      setError(apiError(err, 'Invalid username or password.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input
        name="username"
        label="Username"
        autoFocus
        autoComplete="username"
        leftIcon={<UserIcon className="h-4 w-4" />}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <Input
        name="password"
        type="password"
        label="Password"
        autoComplete="current-password"
        leftIcon={<KeyRound className="h-4 w-4" />}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error}
      />
      <Button type="submit" size="lg" loading={loading} className="w-full">
        Sign in
      </Button>
    </form>
  )
}

function StaffForm() {
  const { pinLogin } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function press(digit: string) {
    setError('')
    setPin((p) => (p.length < 6 ? p + digit : p))
  }

  async function submit() {
    if (!username.trim() || pin.length < 4) {
      setError('Enter your username and PIN.')
      return
    }
    setLoading(true)
    try {
      const user = await pinLogin(username.trim(), pin)
      navigate(homePathForRole(user.role), { replace: true })
    } catch (err) {
      setError(apiError(err, 'Invalid username or PIN.'))
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Input
        name="username"
        label="Username"
        autoFocus
        autoCapitalize="none"
        leftIcon={<UserIcon className="h-4 w-4" />}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <div>
        <label className="mb-2 block text-[0.8rem] font-medium text-ink-700">PIN</label>
        <div className="mb-4 flex justify-center gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className={
                'h-2.5 w-2.5 rounded-full ring-1 ring-inset transition-colors ' +
                (i < pin.length
                  ? 'bg-clay-600 ring-clay-700/20'
                  : 'bg-transparent ring-ink-300')
              }
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <Key key={d} onClick={() => press(d)}>
              {d}
            </Key>
          ))}
          <Key onClick={() => setPin('')} muted>
            Clear
          </Key>
          <Key onClick={() => press('0')}>0</Key>
          <Key onClick={() => setPin((p) => p.slice(0, -1))} muted>
            <Delete className="h-5 w-5" />
          </Key>
        </div>
      </div>
      {error && <p className="text-center text-sm text-danger-600">{error}</p>}
      <Button onClick={submit} size="lg" loading={loading} className="w-full">
        Sign in
      </Button>
    </div>
  )
}

function Key({
  children,
  onClick,
  muted,
}: {
  children: React.ReactNode
  onClick: () => void
  muted?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'grid h-14 place-items-center rounded-lg border font-display text-xl transition-colors active:scale-[0.97] ' +
        (muted
          ? 'border-transparent text-sm font-sans font-medium text-ink-500 hover:bg-ink-100'
          : 'border-ink-200 bg-surface-raised text-ink-800 hover:border-ink-300 hover:bg-surface')
      }
    >
      {children}
    </button>
  )
}

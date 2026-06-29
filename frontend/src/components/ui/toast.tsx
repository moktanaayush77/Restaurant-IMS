import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = ++counter.current
    setToasts((t) => [...t, { id, kind, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-xs flex-col gap-2">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ toast }: { toast: Toast }) {
  const Icon = toast.kind === 'success' ? CheckCircle2 : toast.kind === 'error' ? XCircle : Info
  const accent =
    toast.kind === 'success'
      ? 'text-success-600 bg-success-500'
      : toast.kind === 'error'
        ? 'text-danger-600 bg-danger-500'
        : 'text-clay-600 bg-clay-500'
  const [text, bar] = accent.split(' ')
  return (
    <div
      className={cn(
        'pointer-events-auto relative flex items-start gap-2.5 overflow-hidden rounded-lg border border-ink-200 bg-surface-raised px-4 py-3 pl-5 shadow-raised',
        'animate-[toastIn_.2s_cubic-bezier(0.16,1,0.3,1)]',
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', bar)} />
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', text)} />
      <p className="text-sm text-ink-800">{toast.message}</p>
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.toast
}

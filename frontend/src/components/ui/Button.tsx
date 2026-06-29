import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary:
    'bg-clay-600 text-clay-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-clay-700 active:bg-clay-800 focus-visible:ring-clay-500/50',
  secondary:
    'bg-surface-raised text-ink-800 border border-ink-200 hover:border-ink-300 hover:bg-surface active:bg-ink-100 focus-visible:ring-ink-400/50',
  ghost:
    'text-ink-700 hover:bg-ink-100/80 active:bg-ink-200/70 focus-visible:ring-ink-400/40',
  danger:
    'bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-600 focus-visible:ring-danger-500/50',
  success:
    'bg-success-600 text-white hover:bg-success-700 active:bg-success-700 focus-visible:ring-success-600/50',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-4.5 text-sm gap-2',
  lg: 'h-13 px-6 text-[0.95rem] gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-lg font-medium tracking-[0.005em]',
        'transition-[background-color,border-color,transform,box-shadow] duration-150 active:scale-[0.985]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50',
        'disabled:opacity-45 disabled:pointer-events-none disabled:active:scale-100',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
})

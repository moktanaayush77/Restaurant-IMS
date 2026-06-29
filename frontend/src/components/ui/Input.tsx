import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leftIcon, className, id, ...props },
  ref,
) {
  const inputId = id || props.name
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-[0.8rem] font-medium text-ink-700"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-11 w-full rounded-lg border bg-surface-raised px-3.5 text-ink-900 placeholder:text-ink-400',
            'transition-[border-color,box-shadow] focus:outline-none focus:ring-4',
            leftIcon && 'pl-10',
            error
              ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/15'
              : 'border-ink-200 focus:border-clay-500 focus:ring-clay-500/15',
            className,
          )}
          {...props}
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-sm text-danger-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-ink-500">{hint}</p>
      ) : null}
    </div>
  )
})

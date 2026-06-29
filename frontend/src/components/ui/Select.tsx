import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className, id, children, ...props },
  ref,
) {
  const selectId = id || props.name
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1.5 block text-[0.8rem] font-medium text-ink-700"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'h-11 w-full appearance-none rounded-lg border bg-surface-raised px-3.5 pr-10 text-ink-900',
            'transition-[border-color,box-shadow] focus:outline-none focus:ring-4',
            error
              ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/15'
              : 'border-ink-200 focus:border-clay-500 focus:ring-clay-500/15',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      </div>
      {error && <p className="mt-1.5 text-sm text-danger-600">{error}</p>}
    </div>
  )
})

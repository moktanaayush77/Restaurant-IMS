import { cn } from '../../lib/cn'

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
  disabled?: boolean
}) {
  return (
    <label className={cn('inline-flex items-center gap-2.5', disabled && 'opacity-50')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full ring-1 ring-inset transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50',
          checked ? 'bg-clay-600 ring-clay-700/20' : 'bg-ink-300 ring-ink-400/20',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-surface-raised shadow-sm transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
      {label && <span className="text-sm text-ink-700">{label}</span>}
    </label>
  )
}

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-ink-300 bg-surface/60 px-8 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-clay-50 text-clay-500 ring-1 ring-inset ring-clay-200/60">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-ink-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-xs text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-ink-200 bg-ink-50/85 px-6 py-4 backdrop-blur-md md:px-8">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1.5 text-clay-600">{eyebrow}</p>}
          <h1 className="truncate font-display text-[1.7rem] font-semibold leading-tight text-ink-900">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

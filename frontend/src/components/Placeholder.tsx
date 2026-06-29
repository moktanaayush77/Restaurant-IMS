import type { LucideIcon } from 'lucide-react'
import { PageHeader } from './PageHeader'
import { Badge } from './ui/Badge'

/** Stand-in for a screen that lands in a later milestone. */
export function Placeholder({
  title,
  milestone,
  description,
  icon: Icon,
}: {
  title: string
  milestone: string
  description: string
  icon: LucideIcon
}) {
  return (
    <>
      <PageHeader title={title} />
      <div className="px-6 py-12 md:px-8">
        <div className="mx-auto flex max-w-md flex-col items-center rounded-card border border-dashed border-ink-300 bg-surface/60 px-8 py-12 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-clay-50 text-clay-500 ring-1 ring-inset ring-clay-200/60">
            <Icon className="h-7 w-7" />
          </div>
          <h2 className="mt-5 font-display text-xl font-semibold text-ink-900">{title}</h2>
          <p className="mt-2 text-sm text-ink-500">{description}</p>
          <Badge tone="clay" className="mt-5">
            Arriving in {milestone}
          </Badge>
        </div>
      </div>
    </>
  )
}

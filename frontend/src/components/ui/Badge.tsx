import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Tone = 'neutral' | 'clay' | 'olive' | 'success' | 'warn' | 'danger' | 'info'

const tones: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-600 ring-ink-200',
  clay: 'bg-clay-100 text-clay-700 ring-clay-200/70',
  olive: 'bg-olive-100 text-olive-700 ring-olive-300/60',
  success: 'bg-success-50 text-success-700 ring-success-500/20',
  warn: 'bg-warn-50 text-warn-600 ring-warn-500/25',
  danger: 'bg-danger-50 text-danger-600 ring-danger-500/20',
  info: 'bg-clay-50 text-clay-600 ring-clay-200/60',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.07em] ring-1 ring-inset',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}

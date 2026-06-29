import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-ink-400', className)} />
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50">
      <Spinner className="h-8 w-8 text-clay-500" />
    </div>
  )
}

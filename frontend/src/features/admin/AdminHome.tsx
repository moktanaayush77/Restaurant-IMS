import { BellRing, ClipboardList, Clock, Soup, Wifi, WifiOff } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/toast'
import { cn } from '../../lib/cn'
import { formatMoney, minutesSince } from '../../lib/format'
import { useBranding } from '../settings/useBranding'
import type { Order, OrderStatus } from '../../types'
import { useLiveOrders, useOrders } from '../orders/hooks'
import { ORDER_STATUS_META } from '../orders/status'

const COLUMNS: { status: OrderStatus; label: string; accent: string }[] = [
  { status: 'PLACED', label: 'Placed', accent: 'bg-clay-400' },
  { status: 'PREPARING', label: 'Preparing', accent: 'bg-warn-500' },
  { status: 'READY', label: 'Ready', accent: 'bg-success-500' },
  { status: 'SERVED', label: 'Served', accent: 'bg-ink-400' },
  { status: 'BILLED', label: 'Awaiting payment', accent: 'bg-clay-500' },
]

export function AdminHome() {
  const toast = useToast()
  const { data: branding } = useBranding()
  const symbol = branding?.currency_symbol ?? 'Rs'
  const { data: orders, isLoading } = useOrders('active')

  const live = useLiveOrders({
    onPlaced: (o) => toast(`New order placed · ${o.table_name}`, 'info'),
    onReady: (o) => toast(`${o.table_name} is ready to serve`, 'success'),
  })

  const all = orders ?? []
  const readyCount = all.filter((o) => o.status === 'READY').length

  return (
    <>
      <PageHeader
        eyebrow="Front of house"
        title="Reception"
        subtitle="Live floor — every active order in real time"
        actions={
          <Badge tone={live === 'open' ? 'success' : 'warn'}>
            {live === 'open' ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {live === 'open' ? 'Live' : 'Reconnecting'}
          </Badge>
        }
      />

      <div className="px-6 py-6 md:px-8">
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={ClipboardList} label="Active orders" value={all.length} />
          <Stat icon={BellRing} label="Ready to serve" value={readyCount} tone="success" />
          <Stat
            icon={Soup}
            label="In kitchen"
            value={all.filter((o) => o.status === 'PLACED' || o.status === 'PREPARING').length}
            tone="warn"
          />
          <Stat
            icon={Clock}
            label="Floor total"
            value={formatMoney(
              all.reduce((s, o) => s + parseFloat(o.subtotal), 0),
              symbol,
            )}
          />
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-24">
            <Spinner className="h-7 w-7 text-clay-500" />
          </div>
        ) : !all.length ? (
          <Card className="grid place-items-center py-20 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-clay-50 text-clay-500 ring-1 ring-inset ring-clay-200/60">
              <Soup className="h-7 w-7" />
            </div>
            <h3 className="mt-4 font-display text-xl font-semibold text-ink-900">No active orders</h3>
            <p className="mt-1 text-sm text-ink-500">Orders will stream in as waiters send them.</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {COLUMNS.map((col) => {
              const items = all.filter((o) => o.status === col.status)
              return (
                <div key={col.status} className="flex flex-col">
                  <div className="mb-3 flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', col.accent)} />
                    <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-ink-600">
                      {col.label}
                    </h3>
                    <span className="nums text-xs font-semibold text-ink-400">{items.length}</span>
                  </div>
                  <div className="space-y-3">
                    {items.map((o) => (
                      <OrderCard key={o.id} order={o} symbol={symbol} />
                    ))}
                    {!items.length && (
                      <p className="rounded-lg border border-dashed border-ink-200 py-6 text-center text-xs text-ink-400">
                        Nothing here
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = 'clay',
}: {
  icon: typeof Soup
  label: string
  value: number | string
  tone?: 'clay' | 'success' | 'warn'
}) {
  const tones = {
    clay: 'bg-clay-100/70 text-clay-600 ring-clay-200/50',
    success: 'bg-success-50 text-success-600 ring-success-500/20',
    warn: 'bg-warn-50 text-warn-600 ring-warn-500/20',
  }
  return (
    <Card className="flex items-center gap-3.5 p-4">
      <span
        className={cn(
          'grid h-11 w-11 shrink-0 place-items-center rounded-lg ring-1 ring-inset',
          tones[tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="nums font-display text-2xl font-semibold leading-none text-ink-900">{value}</p>
        <p className="eyebrow mt-1.5">{label}</p>
      </div>
    </Card>
  )
}

function OrderCard({ order, symbol }: { order: Order; symbol: string }) {
  const meta = ORDER_STATUS_META[order.status]
  const lines = order.items.filter((l) => l.status !== 'CANCELLED')
  return (
    <Card className="p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display font-semibold text-ink-900">{order.table_name}</p>
          <p className="eyebrow mt-0.5">
            #{order.id} · {order.waiter_name || 'Waiter'}
          </p>
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>
      <ul className="mt-2.5 space-y-0.5 text-sm text-ink-600">
        {lines.slice(0, 4).map((l) => (
          <li key={l.id} className="truncate">
            <span className="nums text-ink-400">{l.quantity}×</span> {l.name_snapshot}
          </li>
        ))}
        {lines.length > 4 && <li className="text-xs text-ink-400">+{lines.length - 4} more</li>}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-ink-200/70 pt-2.5 text-xs">
        <span className="nums inline-flex items-center gap-1 text-ink-400">
          <Clock className="h-3.5 w-3.5" /> {minutesSince(order.created_at)}m
        </span>
        <span className="nums font-display text-sm font-semibold text-ink-900">
          {formatMoney(order.subtotal, symbol)}
        </span>
      </div>
    </Card>
  )
}

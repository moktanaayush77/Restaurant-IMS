import { useEffect, useState } from 'react'
import { Check, ChefHat, Clock, Flame, Soup, Wifi, WifiOff } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/cn'
import { minutesSince } from '../../lib/format'
import { useToast } from '../../components/ui/toast'
import type { Order } from '../../types'
import {
  useItemAction,
  useKitchenCompletedToday,
  useKitchenHistory,
  useLiveOrders,
  useOrderAction,
  useOrders,
  useVoidRespond,
} from '../orders/hooks'
import { ORDER_STATUS_META, waitUrgency } from '../orders/status'

export function KitchenHome() {
  const toast = useToast()
  const [tab, setTab] = useState<'active' | 'done'>('active')
  const { data: orders, isLoading } = useOrders('kitchen')
  const { data: completedToday } = useKitchenCompletedToday()
  const { data: history } = useKitchenHistory(tab === 'done')

  const live = useLiveOrders({
    onPlaced: (o) => toast(`New order · ${o.table_name}`, 'info'),
    onVoidRequested: (o) =>
      toast(
        `Void requested: ${o.qty ?? ''}× ${o.item_name ?? 'item'} · ${o.table_name}`,
        'info',
      ),
  })

  // Re-render every 30s so wait-time colours stay current without new events.
  const [, force] = useState(0)
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const tickets = orders ?? []

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm font-medium text-ink-300">
          <span className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-clay-400" />
            <span className="nums">{tickets.length}</span> active ticket
            {tickets.length !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-2 text-ink-400">
            <Check className="h-4 w-4 text-success-400" />
            <span className="nums">{completedToday ?? 0}</span> completed today
          </span>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.07em] ring-1 ring-inset',
            live === 'open'
              ? 'bg-success-500/15 text-success-400 ring-success-500/25'
              : 'bg-warn-500/15 text-warn-400 ring-warn-500/25',
          )}
        >
          {live === 'open' ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {live === 'open' ? 'Live' : 'Reconnecting'}
        </span>
      </div>

      {/* Active / Completed tabs */}
      <div className="mb-5 inline-flex rounded-lg bg-white/5 p-1 ring-1 ring-inset ring-white/10">
        {(['active', 'done'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-semibold transition-colors',
              tab === t ? 'bg-clay-600 text-white' : 'text-ink-300 hover:text-white',
            )}
          >
            {t === 'active' ? 'Active' : 'Completed today'}
          </button>
        ))}
      </div>

      {tab === 'active' ? (
        isLoading ? (
          <div className="grid place-items-center py-24">
            <Spinner className="h-8 w-8 text-clay-400" />
          </div>
        ) : !tickets.length ? (
          <div className="grid place-items-center py-24 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-white/5 text-brass-300 ring-1 ring-white/10">
              <Soup className="h-8 w-8" />
            </div>
            <h2 className="mt-5 font-display text-2xl font-semibold text-white">All caught up</h2>
            <p className="mt-1 text-sm text-ink-400">New orders appear here the moment they’re sent.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tickets.map((order) => (
              <Ticket key={order.id} order={order} />
            ))}
          </div>
        )
      ) : !history?.length ? (
        <p className="py-24 text-center text-sm text-ink-400">No tickets completed today yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...history].reverse().map((order) => (
            <HistoryTicket key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryTicket({ order }: { order: Order }) {
  const lines = order.items.filter((l) => l.status !== 'CANCELLED')
  const meta = ORDER_STATUS_META[order.status]
  return (
    <div className="ticket flex flex-col p-4 text-ink-800 opacity-90 shadow-raised">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold leading-none text-ink-900">
            {order.table_name}
          </p>
          <p className="eyebrow mt-1.5">
            #{order.id} · {order.waiter_name || 'Waiter'} · {minutesSince(order.created_at)}m ago
          </p>
        </div>
        {meta && <Badge tone={meta.tone}>{meta.label}</Badge>}
      </div>
      <ul className="mt-3 space-y-1 border-t border-dashed border-ink-300 pt-3 text-sm">
        {lines.map((l) => (
          <li key={l.id} className="flex items-center gap-2">
            <span className="nums font-display font-semibold text-clay-600">{l.quantity}×</span>
            <span className="flex-1 truncate text-ink-700">{l.name_snapshot}</span>
            {l.packed && (
              <span className="text-[0.6rem] font-bold uppercase tracking-wide text-olive-700">
                Pack
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

const URGENCY = {
  calm: { bar: 'bg-ink-300', timer: 'text-ink-500' },
  warn: { bar: 'bg-warn-500', timer: 'text-warn-600' },
  late: { bar: 'bg-danger-500', timer: 'text-danger-600' },
} as const

function Ticket({ order }: { order: Order }) {
  const toast = useToast()
  const start = useOrderAction('start')
  const ready = useOrderAction('ready')
  const itemAction = useItemAction()
  const voidRespond = useVoidRespond()
  const mins = minutesSince(order.created_at)
  const urgency = URGENCY[waitUrgency(mins)]

  async function run(fn: typeof start, label: string) {
    try {
      await fn.mutateAsync({ id: order.id })
    } catch {
      toast(`Couldn’t mark ${label}.`, 'error')
    }
  }

  async function readyItem(lineId: number) {
    try {
      await itemAction.mutateAsync({ id: order.id, item: lineId, action: 'ready' })
    } catch {
      toast('Couldn’t mark that dish ready.', 'error')
    }
  }

  async function respondVoid(lineId: number, approve: boolean, disposition?: 'STASHED' | 'WASTED') {
    try {
      await voidRespond.mutateAsync({ id: order.id, item: lineId, approve, disposition })
      toast(
        !approve
          ? 'Told the waiter: can’t cancel — stays on the bill.'
          : disposition === 'WASTED'
            ? 'Voided & wasted.'
            : 'Voided & stashed to reheat.',
        approve ? 'success' : 'info',
      )
    } catch {
      toast('Couldn’t respond to the void.', 'error')
    }
  }

  const lines = order.items.filter((l) => l.status !== 'CANCELLED')
  const hasUnready = lines.some((l) => l.status === 'PENDING' || l.status === 'PREPARING')

  return (
    <div
      className={cn(
        'ticket flex flex-col text-ink-800 shadow-raised transition-opacity',
        order.status === 'READY' && 'opacity-60',
      )}
    >
      <div className={cn('h-1.5', urgency.bar)} />
      <div className="flex items-start justify-between px-4 pt-3.5">
        <div>
          <p className="font-display text-xl font-semibold leading-none text-ink-900">
            {order.table_name}
          </p>
          <p className="eyebrow mt-1.5">
            #{order.id} · {order.waiter_name || 'Waiter'}
          </p>
        </div>
        <span className={cn('nums inline-flex items-center gap-1 text-sm font-bold', urgency.timer)}>
          <Clock className="h-4 w-4" /> {mins}m
        </span>
      </div>

      <div className="mx-4 mt-3 border-t border-dashed border-ink-300" />

      <ul className="flex-1 space-y-2 px-4 py-3">
        {lines.map((l) => (
          <li key={l.id} className="flex items-start gap-2.5">
            <span className="nums font-display text-base font-semibold text-clay-600">
              {l.quantity}×
            </span>
            <span className="flex-1 leading-snug">
              <span
                className={cn(
                  'font-medium text-ink-800',
                  l.status === 'SERVED' && 'text-ink-400 line-through',
                )}
              >
                {l.name_snapshot}
              </span>
              {l.packed && (
                <span className="ml-1.5 rounded bg-olive-500/20 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-olive-700">
                  Pack
                </span>
              )}
              {l.note && (
                <span className="mt-0.5 block text-xs font-medium text-warn-600">↳ {l.note}</span>
              )}
              {l.void_requested_qty > 0 && (
                <span className="mt-0.5 block text-xs font-semibold text-danger-600">
                  ✗ cancel {l.void_requested_qty}×{l.void_reason ? ` — ${l.void_reason}` : ''}
                </span>
              )}
            </span>
            {l.void_requested_qty > 0 ? (
              <span className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => respondVoid(l.id, false)}
                  disabled={voidRespond.isPending}
                  title="Can't cancel — keep it on the bill"
                  className="rounded-md border border-ink-300 px-2 py-1 text-xs font-semibold text-ink-600 transition-colors hover:bg-ink-100 disabled:opacity-50"
                >
                  Can’t
                </button>
                <button
                  onClick={() => respondVoid(l.id, true, 'STASHED')}
                  disabled={voidRespond.isPending}
                  title="Stash to reheat & cancel"
                  className="rounded-md bg-warn-500 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-warn-600 disabled:opacity-50"
                >
                  Stash
                </button>
                <button
                  onClick={() => respondVoid(l.id, true, 'WASTED')}
                  disabled={voidRespond.isPending}
                  title="Discard & cancel"
                  className="rounded-md bg-danger-500 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-danger-600 disabled:opacity-50"
                >
                  Waste
                </button>
              </span>
            ) : l.status === 'READY' ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-success-600">
                <Check className="h-3.5 w-3.5" /> Ready
              </span>
            ) : l.status === 'SERVED' ? (
              <span className="shrink-0 text-xs text-ink-400">Served</span>
            ) : (
              <button
                onClick={() => readyItem(l.id)}
                disabled={itemAction.isPending}
                className="shrink-0 rounded-md bg-clay-600 px-2.5 py-1 text-xs font-semibold text-clay-50 transition-colors hover:bg-clay-700 disabled:opacity-50"
              >
                Ready
              </button>
            )}
          </li>
        ))}
      </ul>

      {order.note && (
        <p className="mx-4 mb-3 rounded-md bg-warn-50 px-3 py-2 text-xs font-medium text-warn-600 ring-1 ring-inset ring-warn-500/15">
          {order.note}
        </p>
      )}

      <div className="space-y-2 border-t border-dashed border-ink-300 p-3">
        {order.status === 'PLACED' && (
          <Button className="w-full" onClick={() => run(start, 'preparing')} loading={start.isPending}>
            <ChefHat className="h-4 w-4" /> Start preparing
          </Button>
        )}
        {/* Bump everything still cooking in one tap. */}
        {hasUnready && order.status !== 'PLACED' && (
          <Button
            variant="success"
            className="w-full"
            onClick={() => run(ready, 'ready')}
            loading={ready.isPending}
          >
            <Check className="h-4 w-4" /> All ready
          </Button>
        )}
        {!hasUnready && (
          <p className="flex items-center justify-center gap-1.5 py-1 text-sm font-semibold text-success-600">
            <Check className="h-4 w-4" /> All ready · waiter notified
          </p>
        )}
      </div>
    </div>
  )
}

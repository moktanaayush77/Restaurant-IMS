import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Armchair, BellRing, Table2, Wifi, WifiOff } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/EmptyState'
import { useToast } from '../../components/ui/toast'
import { cn } from '../../lib/cn'
import { minutesSince } from '../../lib/format'
import type { Order, Table } from '../../types'
import { useActiveTables, useLiveOrders, useOrders } from '../orders/hooks'
import { ORDER_STATUS_META } from '../orders/status'

const TABLE_TONE: Record<Table['status'], string> = {
  FREE: 'border-ink-200 hover:border-clay-300 hover:bg-surface-raised',
  OCCUPIED: 'border-clay-300 bg-clay-50/40 hover:border-clay-400',
  BILLING: 'border-warn-500/40 bg-warn-50/50 hover:border-warn-500/60',
}

export function WaiterHome() {
  const navigate = useNavigate()
  const toast = useToast()
  const { data: tables, isLoading } = useActiveTables()
  const { data: orders } = useOrders('active')

  const live = useLiveOrders({
    onReady: (o) =>
      toast(
        o.item_name
          ? `${o.item_name} for ${o.table_name} is ready — serve it hot.`
          : `Order for ${o.table_name} is ready to serve.`,
        'success',
      ),
  })

  // The latest active order per table drives each tile's status.
  const orderByTable = useMemo(() => {
    const map = new Map<number, Order>()
    for (const o of orders ?? []) if (!map.has(o.table)) map.set(o.table, o)
    return map
  }, [orders])

  const readyOrders = (orders ?? []).filter((o) => o.status === 'READY')

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1 text-clay-600">Floor plan</p>
          <h1 className="font-display text-[1.7rem] font-semibold text-ink-900">Tables</h1>
          <p className="mt-1 text-sm text-ink-500">Tap a table to take or update an order.</p>
        </div>
        <Badge tone={live === 'open' ? 'success' : 'warn'}>
          {live === 'open' ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {live === 'open' ? 'Live' : 'Reconnecting'}
        </Badge>
      </div>

      {readyOrders.length > 0 && (
        <Card className="mb-5 flex items-center gap-3 border-success-500/40 bg-success-50 p-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-success-500/15 text-success-600">
            <BellRing className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-900">
              {readyOrders.length} order{readyOrders.length > 1 ? 's' : ''} ready to serve
            </p>
            <p className="truncate text-sm text-ink-500">
              {readyOrders.map((o) => o.table_name).join(', ')}
            </p>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="grid place-items-center py-20">
          <Spinner className="h-7 w-7 text-clay-500" />
        </div>
      ) : !tables?.length ? (
        <EmptyState
          icon={Table2}
          title="No tables set up"
          description="Ask an admin to add tables before taking orders."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {tables.map((t) => {
            const order = orderByTable.get(t.id)
            const meta = order ? ORDER_STATUS_META[order.status] : null
            return (
              <button
                key={t.id}
                onClick={() => navigate(`/waiter/table/${t.id}`)}
                className={cn(
                  'group flex flex-col rounded-card border bg-surface p-4 text-left shadow-card transition-all duration-150 active:scale-[0.99]',
                  TABLE_TONE[t.status],
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-clay-100/70 text-clay-600 ring-1 ring-inset ring-clay-200/50">
                    {t.table_type === 'CABIN' ? (
                      <Armchair className="h-[1.15rem] w-[1.15rem]" />
                    ) : (
                      <Table2 className="h-[1.15rem] w-[1.15rem]" />
                    )}
                  </span>
                  {meta ? (
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  ) : (
                    <Badge tone="neutral">Free</Badge>
                  )}
                </div>
                <p className="mt-3 font-display text-xl font-semibold text-ink-900">{t.name}</p>
                {order ? (
                  <p className="nums text-sm text-ink-500">
                    {order.item_count} item{order.item_count !== 1 ? 's' : ''} ·{' '}
                    {minutesSince(order.created_at)}m
                  </p>
                ) : (
                  <p className="text-sm text-ink-400">Tap to seat</p>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

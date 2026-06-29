import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Minus,
  Plus,
  Receipt,
  Search,
  Send,
  ShoppingBag,
  Package,
  Trash2,
  Utensils,
  X,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Switch } from '../../components/ui/Switch'
import { Spinner } from '../../components/ui/Spinner'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/toast'
import { apiError } from '../../lib/api'
import { cn } from '../../lib/cn'
import { formatMoney } from '../../lib/format'
import { useBranding } from '../settings/useBranding'
import type { DraftLine, MenuItem, OrderItem } from '../../types'
import {
  useActiveCategories,
  useActiveItems,
  useActiveTables,
  useAddItems,
  useCancelItem,
  useCreateOrder,
  useGenerateBill,
  useItemAction,
  useLiveOrders,
  useOrderAction,
  useOrderBill,
  useStaffDirectory,
  useTableOrders,
} from '../orders/hooks'
import { ITEM_STATUS_META, ORDER_STATUS_META } from '../orders/status'
import { BillBreakdown } from '../billing/BillBreakdown'

const DISPOSITION_LABEL: Record<string, string> = {
  VOIDED: 'voided',
  STASHED: 'stashed',
  WASTED: 'wasted',
}

export function OrderScreen() {
  const { tableId } = useParams()
  const id = Number(tableId)
  const navigate = useNavigate()
  const toast = useToast()
  const { data: branding } = useBranding()
  const symbol = branding?.currency_symbol ?? 'Rs'

  const { data: tables } = useActiveTables()
  const { data: orders, isLoading } = useTableOrders(id)
  const { data: categories } = useActiveCategories()
  const { data: items } = useActiveItems()

  useLiveOrders({
    onReady: (o) =>
      o.table === id &&
      toast(o.item_name ? `${o.item_name} is ready — serve it hot.` : 'Order is ready to serve.', 'success'),
    onVoidDeclined: (o) =>
      o.table === id &&
      toast(`Kitchen can't cancel ${o.item_name ?? 'that item'} — it's already made, so it stays on the bill.`, 'error'),
  })

  const table = tables?.find((t) => t.id === id)
  // The open ticket for this table (active scope already excludes paid/cancelled).
  const order = (orders ?? [])[0] ?? null
  const isBilled = order?.status === 'BILLED'
  const { data: bill } = useOrderBill(isBilled ? order!.id : undefined)

  const [cart, setCart] = useState<DraftLine[]>([])
  const [guests, setGuests] = useState(2)
  const [activeCat, setActiveCat] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [voiding, setVoiding] = useState<OrderItem | null>(null)
  const [staffMeal, setStaffMeal] = useState(false)
  const [staffMember, setStaffMember] = useState<number | ''>('')
  const { data: staffDir } = useStaffDirectory()

  const create = useCreateOrder()
  const addItems = useAddItems()
  const serve = useOrderAction('serve')
  const cancel = useOrderAction('cancel')
  const generateBill = useGenerateBill()
  const itemAction = useItemAction()

  async function serveItem(lineId: number) {
    if (!order) return
    try {
      await itemAction.mutateAsync({ id: order.id, item: lineId, action: 'serve' })
    } catch (e) {
      toast(apiError(e), 'error')
    }
  }

  async function requestBill() {
    if (!order) return
    try {
      await generateBill.mutateAsync({ order: order.id })
      toast('Bill sent to reception.')
    } catch (e) {
      toast(apiError(e), 'error')
    }
  }

  const visibleItems = useMemo(() => {
    let list = items ?? []
    if (activeCat !== 'all') list = list.filter((i) => i.category === activeCat)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((i) => i.name.toLowerCase().includes(q))
    }
    return list
  }, [items, activeCat, search])

  function addToCart(item: MenuItem) {
    setCart((c) => {
      const existing = c.find((l) => l.menu_item === item.id)
      if (existing)
        return c.map((l) =>
          l.menu_item === item.id ? { ...l, quantity: l.quantity + 1 } : l,
        )
      return [
        ...c,
        {
          menu_item: item.id,
          name: item.name,
          unit_price: item.price,
          quantity: 1,
          note: '',
          packed: false,
          is_packable: item.is_packable,
        },
      ]
    })
  }

  function setQty(menuItem: number, delta: number) {
    setCart((c) =>
      c
        .map((l) => (l.menu_item === menuItem ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    )
  }

  function togglePack(menuItem: number) {
    setCart((c) => c.map((l) => (l.menu_item === menuItem ? { ...l, packed: !l.packed } : l)))
  }

  const cartCount = cart.reduce((n, l) => n + l.quantity, 0)
  const cartTotal = cart.reduce((s, l) => s + parseFloat(l.unit_price) * l.quantity, 0)

  async function send() {
    if (!cart.length) return
    if (!order && staffMeal && !staffMember) {
      toast('Pick which staff member this meal is for.', 'error')
      return
    }
    try {
      if (order) {
        await addItems.mutateAsync({ id: order.id, items: cart })
        toast('Items sent to the kitchen.')
      } else {
        await create.mutateAsync({
          table: id,
          guest_count: guests,
          items: cart,
          is_staff_meal: staffMeal,
          staff_member: staffMeal ? Number(staffMember) : null,
        })
        toast(staffMeal ? 'Staff meal sent to the kitchen.' : 'Order sent to the kitchen.')
      }
      setCart([])
    } catch (e) {
      toast(apiError(e), 'error')
    }
  }

  async function markServed() {
    if (!order) return
    try {
      await serve.mutateAsync({ id: order.id })
      toast('Marked as served.')
    } catch (e) {
      toast(apiError(e), 'error')
    }
  }

  async function doCancel() {
    if (!order) return
    try {
      await cancel.mutateAsync({ id: order.id })
      toast('Order cancelled.')
      setCancelOpen(false)
      navigate('/waiter')
    } catch (e) {
      toast(apiError(e), 'error')
    }
  }

  const sending = create.isPending || addItems.isPending

  return (
    <div className="flex min-h-[calc(100vh-65px)] flex-col lg:grid lg:grid-cols-[1fr_380px]">
      {/* ------------------------------ Menu ------------------------------ */}
      <div className="flex min-h-0 min-w-0 flex-col border-b border-ink-200 lg:border-b-0 lg:border-r">
        <div className="sticky top-0 z-10 space-y-3 border-b border-ink-200 bg-ink-50/90 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/waiter')}
              className="grid h-10 w-10 place-items-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-display text-xl font-semibold leading-tight text-ink-900">
                {table?.name ?? 'Table'}
              </h1>
              <p className="eyebrow mt-0.5">
                {table?.section || 'Floor'} · {order ? `Order #${order.id}` : 'New order'}
              </p>
            </div>
            {order && (
              <Badge tone={ORDER_STATUS_META[order.status].tone}>
                {ORDER_STATUS_META[order.status].label}
              </Badge>
            )}
          </div>

          <Input
            leftIcon={<Search className="h-4 w-4" />}
            placeholder="Search dishes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <CategoryPill active={activeCat === 'all'} onClick={() => setActiveCat('all')}>
              All
            </CategoryPill>
            {categories?.map((c) => (
              <CategoryPill
                key={c.id}
                active={activeCat === c.id}
                onClick={() => setActiveCat(c.id)}
              >
                {c.name}
              </CategoryPill>
            ))}
          </div>
        </div>

        <div className="flex-1 px-4 py-4 sm:px-6">
          {!items ? (
            <div className="grid place-items-center py-20">
              <Spinner className="h-7 w-7 text-clay-500" />
            </div>
          ) : !visibleItems.length ? (
            <p className="py-16 text-center text-sm text-ink-400">No dishes match.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {visibleItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="group flex items-start gap-2.5 rounded-lg border border-ink-200 bg-surface px-3.5 py-3 text-left transition-colors hover:border-clay-300 hover:bg-clay-50/50"
                >
                  <span className="min-w-0 flex-1 font-medium leading-snug text-ink-900">
                    {item.name}
                  </span>
                  <span className="nums shrink-0 font-display text-sm font-semibold text-clay-700">
                    {formatMoney(item.price, symbol)}
                  </span>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-clay-100/70 text-clay-600 transition-colors group-hover:bg-clay-600 group-hover:text-clay-50">
                    <Plus className="h-4 w-4" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --------------------------- Order panel --------------------------- */}
      <aside className="flex flex-col bg-surface lg:h-[calc(100vh-65px)] lg:overflow-hidden">
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
          {isLoading ? (
            <div className="grid place-items-center py-12">
              <Spinner className="h-6 w-6 text-clay-500" />
            </div>
          ) : (
            <>
              {/* Already-sent items */}
              {order && order.items.length > 0 && (
                <div>
                  <p className="eyebrow mb-2.5">Sent to kitchen</p>
                  <div className="space-y-1.5">
                    {order.items
                      .filter((l) => l.status !== 'CANCELLED')
                      .map((l) => (
                        <div key={l.id} className="flex items-center gap-2 text-sm">
                          <span className="nums font-display font-semibold text-ink-700">
                            {l.quantity}×
                          </span>
                          <span className="flex flex-1 items-center gap-1.5 truncate text-ink-800">
                            <span className="truncate">{l.name_snapshot}</span>
                            {l.packed && <Badge tone="olive">Pack</Badge>}
                          </span>
                          {l.void_requested_qty > 0 ? (
                            <Badge tone="warn">Void {l.void_requested_qty}× · kitchen</Badge>
                          ) : (
                            <>
                              {l.status === 'READY' ? (
                                <button
                                  onClick={() => serveItem(l.id)}
                                  disabled={itemAction.isPending}
                                  className="inline-flex items-center gap-1 rounded-md bg-success-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-success-700 disabled:opacity-50"
                                >
                                  <Utensils className="h-3.5 w-3.5" /> Serve
                                </button>
                              ) : (
                                <Badge tone={ITEM_STATUS_META[l.status].tone}>
                                  {ITEM_STATUS_META[l.status].label}
                                </Badge>
                              )}
                              {l.status !== 'SERVED' && (
                                <button
                                  onClick={() => setVoiding(l)}
                                  title="Cancel item"
                                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-400 transition-colors hover:bg-danger-500/10 hover:text-danger-600"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Cancelled — kept visible so every plate stays accounted for (#7). */}
              {order && order.items.some((l) => l.status === 'CANCELLED') && (
                <div>
                  <p className="eyebrow mb-2.5 text-ink-400">Cancelled</p>
                  <div className="space-y-1">
                    {order.items
                      .filter((l) => l.status === 'CANCELLED')
                      .map((l) => (
                        <div key={l.id} className="flex items-center gap-2 text-sm text-ink-400">
                          <span className="nums font-display">{l.quantity}×</span>
                          <span className="flex-1 truncate line-through">{l.name_snapshot}</span>
                          <Badge tone="neutral">
                            {DISPOSITION_LABEL[l.cancel_disposition] ?? 'cancelled'}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Once billed, the panel becomes a read-only receipt. */}
              {isBilled && bill && (
                <div className="rounded-card border border-clay-200 bg-clay-50/50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-clay-700">
                    <Receipt className="h-4 w-4" />
                    <span className="text-sm font-semibold">Bill {bill.bill_number}</span>
                  </div>
                  <BillBreakdown bill={bill} symbol={symbol} />
                  <p className="mt-3 text-xs text-ink-500">
                    Sent to reception — the guest pays at the counter.
                  </p>
                </div>
              )}

              {/* Cart (new round) */}
              {!isBilled && (
                <div>
                  <p className="eyebrow mb-2.5">{order ? 'New round' : 'New order'}</p>
                  {!cart.length ? (
                    <div className="flex flex-col items-center rounded-lg border border-dashed border-ink-300 py-8 text-center">
                      <ShoppingBag className="h-6 w-6 text-ink-300" />
                      <p className="mt-2 text-sm text-ink-400">Tap dishes to add them.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cart.map((l) => (
                        <div
                          key={l.menu_item}
                          className="flex items-center gap-2 rounded-lg border border-ink-200 bg-surface-raised px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink-900">{l.name}</p>
                            <p className="nums text-xs text-ink-500">
                              {formatMoney(l.unit_price, symbol)}
                            </p>
                            {l.is_packable && (
                              <button
                                onClick={() => togglePack(l.menu_item)}
                                className={cn(
                                  'mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.7rem] font-semibold transition-colors',
                                  l.packed
                                    ? 'bg-olive-100 text-olive-700'
                                    : 'text-ink-400 hover:bg-ink-100',
                                )}
                              >
                                <Package className="h-3 w-3" /> {l.packed ? 'Packed' : 'Pack'}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setQty(l.menu_item, -1)}
                              className="grid h-7 w-7 place-items-center rounded-md border border-ink-200 text-ink-600 transition-colors hover:bg-ink-100"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="nums w-5 text-center text-sm font-semibold text-ink-900">
                              {l.quantity}
                            </span>
                            <button
                              onClick={() => setQty(l.menu_item, 1)}
                              className="grid h-7 w-7 place-items-center rounded-md border border-ink-200 text-ink-600 transition-colors hover:bg-ink-100"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!order && (
                <div className="space-y-3">
                  <div className="w-28">
                    <Input
                      label="Guests"
                      type="number"
                      min={1}
                      value={guests}
                      onChange={(e) => setGuests(Math.max(1, Number(e.target.value)))}
                    />
                  </div>
                  <div className="rounded-lg border border-ink-200 bg-surface-raised p-3">
                    <Switch
                      checked={staffMeal}
                      onChange={setStaffMeal}
                      label="Staff meal (charge to salary)"
                    />
                    {staffMeal && (
                      <div className="mt-3">
                        <Select
                          label="Staff member"
                          value={staffMember}
                          onChange={(e) =>
                            setStaffMember(e.target.value ? Number(e.target.value) : '')
                          }
                        >
                          <option value="">Select…</option>
                          {(staffDir ?? []).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.display_name}
                            </option>
                          ))}
                        </Select>
                        <p className="mt-1.5 text-xs text-ink-500">
                          No payment — recorded against this person for salary deduction (tax-free).
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action bar */}
        <div className="space-y-2 border-t border-ink-200 bg-surface px-4 py-3 sm:px-5">
          {isBilled ? (
            <Button variant="secondary" className="w-full" onClick={() => navigate('/waiter')}>
              <ArrowLeft className="h-4 w-4" /> Back to tables
            </Button>
          ) : (
            <>
              {cart.length > 0 && (
                <div className="flex items-baseline text-sm">
                  <span className="nums text-ink-500">{cartCount} items</span>
                  <span className="leader" />
                  <span className="nums font-display text-base font-semibold text-ink-900">
                    {formatMoney(cartTotal, symbol)}
                  </span>
                </div>
              )}
              <Button className="w-full" onClick={send} loading={sending} disabled={!cart.length}>
                <Send className="h-4 w-4" />
                {order ? 'Add to order' : 'Send to kitchen'}
              </Button>
              {order && order.status === 'READY' && (
                <Button
                  variant="success"
                  className="w-full"
                  onClick={markServed}
                  loading={serve.isPending}
                >
                  <Utensils className="h-4 w-4" /> Serve all ready
                </Button>
              )}
              {order && order.status === 'SERVED' && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={requestBill}
                  loading={generateBill.isPending}
                >
                  <Receipt className="h-4 w-4" /> Request bill
                </Button>
              )}
              {order && order.status === 'PLACED' && (
                <Button variant="ghost" className="w-full" onClick={() => setCancelOpen(true)}>
                  <Trash2 className="h-4 w-4" /> Cancel order
                </Button>
              )}
            </>
          )}
        </div>
      </aside>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={doCancel}
        title="Cancel order"
        message={`Cancel order #${order?.id} for ${table?.name}? This frees the table.`}
        confirmLabel="Cancel order"
        destructive
        loading={cancel.isPending}
      />

      {voiding && order && (
        <CancelItemModal order={order.id} item={voiding} onClose={() => setVoiding(null)} />
      )}
    </div>
  )
}

function CancelItemModal({
  order,
  item,
  onClose,
}: {
  order: number
  item: OrderItem
  onClose: () => void
}) {
  const cancelItem = useCancelItem()
  const toast = useToast()
  const [qty, setQty] = useState(item.quantity)
  const [reason, setReason] = useState('')
  const cooking = item.status === 'PREPARING' || item.status === 'READY'

  async function submit() {
    try {
      await cancelItem.mutateAsync({ id: order, item: item.id, quantity: qty, reason })
      toast(
        cooking
          ? 'Void requested — the kitchen will confirm.'
          : `Cancelled ${qty}× ${item.name_snapshot}.`,
      )
      onClose()
    } catch (e) {
      toast(apiError(e), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title={`Cancel ${item.name_snapshot}`} size="sm">
      <div className="space-y-4">
        {cooking && (
          <p className="rounded-lg bg-warn-50 px-3 py-2 text-xs text-warn-600 ring-1 ring-inset ring-warn-500/15">
            This dish is already cooking — the kitchen has to confirm the void.
          </p>
        )}
        <div>
          <label className="mb-2 block text-[0.8rem] font-medium text-ink-700">
            Quantity to cancel
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-100"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="nums w-10 text-center text-lg font-semibold text-ink-900">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(item.quantity, q + 1))}
              className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-100"
            >
              <Plus className="h-4 w-4" />
            </button>
            <span className="text-sm text-ink-400">of {item.quantity}</span>
          </div>
        </div>
        <Input
          label="Reason (optional)"
          placeholder="e.g. customer changed their mind"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Keep it
        </Button>
        <Button variant="danger" onClick={submit} loading={cancelItem.isPending}>
          {cooking ? 'Request void' : 'Cancel item'}
        </Button>
      </div>
    </Modal>
  )
}

function CategoryPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-clay-600 text-clay-50'
          : 'bg-surface-raised text-ink-600 ring-1 ring-inset ring-ink-200 hover:bg-ink-100',
      )}
    >
      {children}
    </button>
  )
}

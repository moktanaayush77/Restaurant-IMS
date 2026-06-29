import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useLiveSocket, type LiveEvent, type LiveStatus } from '../../lib/useLiveSocket'
import type {
  Bill,
  DraftLine,
  MenuCategory,
  MenuItem,
  Order,
  Paginated,
  PaymentStatus,
  Role,
  Table,
} from '../../types'

export interface StaffDirectoryEntry {
  id: number
  display_name: string
  role: Role
}

export interface StaffMealsReport {
  label: string
  grand_total: number
  rows: { staff: string; orders: number; total: number }[]
}

const PAGE = { params: { page_size: 500 } }

/* ---- Read helpers scoped to what staff need on the floor (active only) ---- */

export function useActiveTables() {
  return useQuery({
    queryKey: ['tables'],
    queryFn: async () =>
      (await api.get<Paginated<Table>>('/tables/', { params: { ...PAGE.params, active: 'true' } }))
        .data.results,
  })
}

export function useActiveCategories() {
  return useQuery({
    queryKey: ['menu-categories', 'active'],
    queryFn: async () =>
      (
        await api.get<Paginated<MenuCategory>>('/menu/categories/', {
          params: { ...PAGE.params, active: 'true' },
        })
      ).data.results,
  })
}

export function useActiveItems() {
  return useQuery({
    queryKey: ['menu-items', 'active'],
    queryFn: async () =>
      (
        await api.get<Paginated<MenuItem>>('/menu/items/', {
          params: { ...PAGE.params, active: 'true' },
        })
      ).data.results,
  })
}

type Scope = 'active' | 'kitchen'

/** Live orders for a screen. `scope` maps to the backend query filters. */
export function useOrders(scope: Scope) {
  return useQuery({
    queryKey: ['orders', scope],
    queryFn: async () =>
      (await api.get<Paginated<Order>>('/orders/', { params: { ...PAGE.params, scope } })).data
        .results,
  })
}

/** Count of tickets the kitchen finished today (KDS completed counter). */
export function useKitchenCompletedToday() {
  return useQuery({
    queryKey: ['orders', 'done-today'],
    queryFn: async () =>
      (await api.get<Paginated<Order>>('/orders/', { params: { done: 'today', page_size: 1 } }))
        .data.count,
  })
}

/** All active orders for one table (used by the waiter order screen). */
export function useTableOrders(tableId: number | undefined) {
  return useQuery({
    enabled: tableId != null,
    queryKey: ['orders', 'table', tableId],
    queryFn: async () =>
      (
        await api.get<Paginated<Order>>('/orders/', {
          params: { ...PAGE.params, scope: 'active', table: tableId },
        })
      ).data.results,
  })
}

function lines(draft: DraftLine[]) {
  return draft.map((l) => ({
    menu_item: l.menu_item,
    quantity: l.quantity,
    note: l.note,
    packed: l.packed,
  }))
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: async (input: {
      table: number
      guest_count: number
      note?: string
      items: DraftLine[]
      is_staff_meal?: boolean
      staff_member?: number | null
    }) =>
      (
        await api.post<Order>('/orders/', {
          table: input.table,
          guest_count: input.guest_count,
          note: input.note ?? '',
          is_staff_meal: input.is_staff_meal ?? false,
          staff_member: input.is_staff_meal ? input.staff_member : null,
          items: lines(input.items),
        })
      ).data,
  })
}

export function useAddItems() {
  return useMutation({
    mutationFn: async (input: { id: number; items: DraftLine[] }) =>
      (await api.post<Order>(`/orders/${input.id}/add_items/`, { items: lines(input.items) })).data,
  })
}

/** Order lifecycle transitions — `start`, `ready`, `serve`, `cancel`. */
export function useOrderAction(action: 'start' | 'ready' | 'serve' | 'cancel') {
  return useMutation({
    mutationFn: async (input: { id: number; reason?: string }) =>
      (
        await api.post<Order>(
          `/orders/${input.id}/${action}/`,
          action === 'cancel' ? { reason: input.reason ?? '' } : {},
        )
      ).data,
  })
}

/** Transition a single line item (dish-by-dish): chef `start`/`ready`, waiter `serve`. */
export function useItemAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: number
      item: number
      action: 'start' | 'ready' | 'serve' | 'cancel'
    }) =>
      (await api.post<Order>(`/orders/${input.id}/item/`, { item: input.item, action: input.action }))
        .data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['tables'] })
    },
  })
}

/**
 * Waiter cancels units of a line. Not-yet-started (PENDING) units cancel
 * immediately; cooking units raise a kitchen void request the kitchen confirms.
 */
export function useCancelItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: number; item: number; quantity: number; reason?: string }) =>
      (
        await api.post<Order>(`/orders/${input.id}/cancel_item/`, {
          item: input.item,
          quantity: input.quantity,
          reason: input.reason ?? '',
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['tables'] })
    },
  })
}

/**
 * Kitchen responds to a void request: approve with a disposition (STASHED = keep
 * to reheat, WASTED = discard) to cancel, or `approve: false` for "can't cancel".
 */
export function useVoidRespond() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: number
      item: number
      approve: boolean
      disposition?: 'STASHED' | 'WASTED'
    }) =>
      (
        await api.post<Order>(`/orders/${input.id}/void_respond/`, {
          item: input.item,
          approve: input.approve,
          disposition: input.disposition,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['tables'] })
    },
  })
}

/* -------------------------------- Billing -------------------------------- */

export function useBills(paymentStatus?: PaymentStatus) {
  return useQuery({
    queryKey: ['bills', paymentStatus ?? 'all'],
    queryFn: async () =>
      (
        await api.get<Paginated<Bill>>('/bills/', {
          params: { ...PAGE.params, payment_status: paymentStatus },
        })
      ).data.results,
  })
}

/** The bill attached to a single order (used by the waiter once it's billed). */
export function useOrderBill(orderId: number | undefined) {
  return useQuery({
    enabled: orderId != null,
    queryKey: ['bills', 'order', orderId],
    queryFn: async () =>
      (await api.get<Paginated<Bill>>('/bills/', { params: { order: orderId } })).data.results[0] ??
      null,
  })
}

function invalidateBilling(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['bills'] })
  qc.invalidateQueries({ queryKey: ['orders'] })
  qc.invalidateQueries({ queryKey: ['tables'] })
}

export function useGenerateBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { order: number; discount?: number }) =>
      (await api.post<Bill>('/bills/generate/', { order: input.order, discount: input.discount ?? 0 }))
        .data,
    onSuccess: () => invalidateBilling(qc),
  })
}

export function usePayBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: number; payment_method: string }) =>
      (await api.post<Bill>(`/bills/${input.id}/pay/`, { payment_method: input.payment_method }))
        .data,
    onSuccess: () => invalidateBilling(qc),
  })
}

/** Active staff (names only) so a waiter can attribute a staff meal. */
export function useStaffDirectory() {
  return useQuery({
    queryKey: ['staff-directory'],
    queryFn: async () => (await api.get<StaffDirectoryEntry[]>('/staff-directory/')).data,
  })
}

/** Per-staff staff-meal totals for a period (accountant settles these). */
export function useStaffMealsReport(period: string) {
  return useQuery({
    queryKey: ['staff-meals', period],
    queryFn: async () =>
      (await api.get<StaffMealsReport>('/reports/staff-meals/', { params: { period } })).data,
  })
}

/** A "ready" event payload — the order, plus the specific dish when item-level. */
export type ReadyPayload = Order & { item_name?: string; qty?: number }

interface LiveOptions {
  /** Fired when a whole order, or a single dish, becomes ready (waiter screens). */
  onReady?: (payload: ReadyPayload) => void
  /** Fired when a brand-new order is placed (kitchen / reception alerts). */
  onPlaced?: (order: Order) => void
  /** Fired when a waiter asks the kitchen to void units (kitchen alert). */
  onVoidRequested?: (payload: ReadyPayload) => void
  /** Fired when the kitchen declines a void (waiter notification). */
  onVoidDeclined?: (payload: ReadyPayload) => void
}

/**
 * Open the live socket and keep every order/table query fresh as events arrive.
 * Returns the connection status so a screen can show an online/offline pill.
 */
export function useLiveOrders(options: LiveOptions = {}): LiveStatus {
  const qc = useQueryClient()
  return useLiveSocket((msg: LiveEvent) => {
    if (!msg.event.startsWith('order.')) return
    // Any transition can change which orders are active and table occupancy.
    qc.invalidateQueries({ queryKey: ['orders'] })
    qc.invalidateQueries({ queryKey: ['tables'] })
    if (msg.event === 'order.billed' || msg.event === 'order.paid')
      qc.invalidateQueries({ queryKey: ['bills'] })
    if (msg.event === 'order.ready' || msg.event === 'order.item_ready')
      options.onReady?.(msg.payload as ReadyPayload)
    if (msg.event === 'order.placed') options.onPlaced?.(msg.payload as Order)
    if (msg.event === 'order.void_requested') options.onVoidRequested?.(msg.payload as ReadyPayload)
    if (msg.event === 'order.void_declined') options.onVoidDeclined?.(msg.payload as ReadyPayload)
  })
}

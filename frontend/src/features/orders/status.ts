import type { ItemStatus, OrderStatus } from '../../types'

type Tone = 'neutral' | 'clay' | 'success' | 'warn' | 'danger' | 'info'

/** Display label + Badge tone for each order status, used across all screens. */
export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: Tone }> = {
  PLACED: { label: 'Placed', tone: 'info' },
  PREPARING: { label: 'Preparing', tone: 'warn' },
  READY: { label: 'Ready', tone: 'success' },
  SERVED: { label: 'Served', tone: 'neutral' },
  BILLED: { label: 'Billed', tone: 'clay' },
  PAID: { label: 'Paid', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
}

export const ITEM_STATUS_META: Record<ItemStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Pending', tone: 'neutral' },
  PREPARING: { label: 'Preparing', tone: 'warn' },
  READY: { label: 'Ready', tone: 'success' },
  SERVED: { label: 'Served', tone: 'info' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
}

/**
 * KDS wait-time urgency from minutes elapsed. Tickets escalate cool → warm → hot
 * so a busy kitchen can triage at a glance.
 */
export function waitUrgency(minutes: number): 'calm' | 'warn' | 'late' {
  if (minutes >= 15) return 'late'
  if (minutes >= 8) return 'warn'
  return 'calm'
}

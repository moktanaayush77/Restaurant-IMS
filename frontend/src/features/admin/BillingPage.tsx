import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CheckCircle2, Clock, Receipt, Wifi, WifiOff } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState } from '../../components/EmptyState'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/toast'
import { apiError } from '../../lib/api'
import { cn } from '../../lib/cn'
import { formatMoney, minutesSince } from '../../lib/format'
import { useBranding } from '../settings/useBranding'
import type { Bill, PaymentMethod } from '../../types'
import { useBills, useLiveOrders, usePayBill } from '../orders/hooks'
import { BillBreakdown } from '../billing/BillBreakdown'

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'ESEWA', label: 'eSewa' },
  { value: 'KHALTI', label: 'Khalti' },
  { value: 'BANK', label: 'Bank / QR' },
  { value: 'STAFF', label: 'Staff (salary deduction)' },
  { value: 'OTHER', label: 'Other' },
]

const METHOD_LABEL: Record<string, string> = Object.fromEntries(
  METHODS.map((m) => [m.value, m.label]),
)

export function BillingPage() {
  const toast = useToast()
  const { data: branding } = useBranding()
  const symbol = branding?.currency_symbol ?? 'Rs'
  const [tab, setTab] = useState<'unpaid' | 'history'>('unpaid')
  const { data: bills, isLoading } = useBills(tab === 'unpaid' ? 'UNPAID' : 'PAID')
  const [settling, setSettling] = useState<Bill | null>(null)

  const live = useLiveOrders()

  const list = bills ?? []
  const due = list.reduce((s, b) => s + parseFloat(b.total), 0)

  return (
    <>
      <PageHeader
        eyebrow="Counter"
        title="Billing"
        subtitle="Confirm payments and review bill history"
        actions={
          <Badge tone={live === 'open' ? 'success' : 'warn'}>
            {live === 'open' ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {live === 'open' ? 'Live' : 'Reconnecting'}
          </Badge>
        }
      />
      <div className="px-6 py-6 md:px-8">
        <div className="mb-6 inline-flex rounded-lg border border-ink-200 bg-surface-raised p-1 shadow-card">
          {(['unpaid', 'history'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                tab === t ? 'bg-clay-600 text-white' : 'text-ink-600 hover:bg-ink-100',
              )}
            >
              {t === 'unpaid' ? 'Awaiting payment' : 'History'}
            </button>
          ))}
        </div>

        {tab === 'unpaid' && !isLoading && list.length > 0 && (
          <Card className="mb-5 flex items-center justify-between p-4">
            <div>
              <p className="eyebrow text-ink-400">Awaiting payment</p>
              <p className="mt-0.5 text-sm text-ink-600">
                <span className="nums">{list.length}</span> bill{list.length > 1 ? 's' : ''} at the counter
              </p>
            </div>
            <span className="nums font-display text-2xl text-ink-900">{formatMoney(due, symbol)}</span>
          </Card>
        )}

        {isLoading ? (
          <div className="grid place-items-center py-20">
            <Spinner className="h-7 w-7 text-clay-500" />
          </div>
        ) : !list.length ? (
          <EmptyState
            icon={Receipt}
            title={tab === 'unpaid' ? 'No bills to settle' : 'No paid bills yet'}
            description={
              tab === 'unpaid'
                ? 'When a waiter requests a bill it appears here for payment confirmation.'
                : 'Settled bills will show up here.'
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((bill) => (
              <Card key={bill.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg text-ink-900">{bill.table_name}</p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      <span className="nums">{bill.bill_number}</span> · {bill.waiter_name || 'Waiter'}
                    </p>
                    {bill.order_detail?.is_staff_meal && (
                      <Badge tone="clay" className="mt-1.5">
                        Staff meal · {bill.order_detail.staff_member_name}
                      </Badge>
                    )}
                  </div>
                  {tab === 'unpaid' ? (
                    <Badge tone="warn">
                      <Clock className="h-3.5 w-3.5" />{' '}
                      <span className="nums">{minutesSince(bill.created_at)}</span>m
                    </Badge>
                  ) : (
                    <Badge tone="success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                    </Badge>
                  )}
                </div>

                <div className="my-4 flex-1">
                  <BillBreakdown bill={bill} symbol={symbol} />
                </div>

                {tab === 'unpaid' ? (
                  <Button className="w-full" onClick={() => setSettling(bill)}>
                    <CheckCircle2 className="h-4 w-4" /> Confirm payment
                  </Button>
                ) : (
                  <div className="flex items-center justify-between border-t border-ink-100 pt-3 text-xs text-ink-500">
                    <span className="font-medium text-ink-600">
                      {METHOD_LABEL[bill.payment_method] ?? bill.payment_method}
                    </span>
                    <span className="nums">
                      {bill.paid_at ? format(parseISO(bill.paid_at), 'd MMM, h:mm a') : ''}
                    </span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {settling && (
        <SettleModal
          bill={settling}
          symbol={symbol}
          onClose={() => setSettling(null)}
          onPaid={() => {
            toast(`Payment confirmed for ${settling.table_name}.`)
            setSettling(null)
          }}
        />
      )}
    </>
  )
}

function SettleModal({
  bill,
  symbol,
  onClose,
  onPaid,
}: {
  bill: Bill
  symbol: string
  onClose: () => void
  onPaid: () => void
}) {
  const toast = useToast()
  const pay = usePayBill()
  const [method, setMethod] = useState<PaymentMethod>(
    bill.order_detail?.is_staff_meal ? 'STAFF' : 'CASH',
  )

  async function confirm() {
    try {
      await pay.mutateAsync({ id: bill.id, payment_method: method })
      onPaid()
    } catch (e) {
      toast(apiError(e), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title={`Settle ${bill.table_name}`} description={bill.bill_number}>
      <div className="space-y-4">
        <Card className="bg-surface-sunk p-4 shadow-none">
          <BillBreakdown bill={bill} symbol={symbol} />
        </Card>
        <Select
          label="Payment method"
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
        >
          {METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
        <p className="text-xs text-ink-500">
          This records that the guest has paid at the counter. It frees the table.
        </p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="success" onClick={confirm} loading={pay.isPending}>
          <CheckCircle2 className="h-4 w-4" /> Mark paid · <span className="nums">{formatMoney(bill.total, symbol)}</span>
        </Button>
      </div>
    </Modal>
  )
}

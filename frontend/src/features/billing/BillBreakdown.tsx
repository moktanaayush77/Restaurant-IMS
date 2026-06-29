import { formatMoney } from '../../lib/format'
import { cn } from '../../lib/cn'
import type { Bill } from '../../types'

/** The subtotal → discount → service charge → VAT → total ladder on a bill. */
export function BillBreakdown({ bill, symbol }: { bill: Bill; symbol: string }) {
  const rows: { label: string; value: string; muted?: boolean }[] = [
    { label: 'Subtotal', value: bill.subtotal },
  ]
  if (parseFloat(bill.discount) > 0)
    rows.push({ label: 'Discount', value: `- ${formatMoney(bill.discount, symbol)}`, muted: true })
  rows.push({
    label: `Service charge (${bill.service_charge_percent}%)`,
    value: bill.service_charge,
    muted: true,
  })
  rows.push({ label: `VAT (${bill.vat_percent}%)`, value: bill.vat, muted: true })

  return (
    <div className="space-y-2 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline">
          <span className={r.muted ? 'text-ink-500' : 'text-ink-700'}>{r.label}</span>
          <span className="leader" />
          <span className={cn('nums', r.muted ? 'text-ink-500' : 'text-ink-800')}>
            {r.value.startsWith('-') ? r.value : formatMoney(r.value, symbol)}
          </span>
        </div>
      ))}
      <div className="mt-2.5 flex items-baseline border-t border-ink-200 pt-3">
        <span className="font-display text-base font-semibold text-ink-900">Total</span>
        <span className="leader" />
        <span className="nums font-display text-2xl text-ink-900">{formatMoney(bill.total, symbol)}</span>
      </div>
    </div>
  )
}

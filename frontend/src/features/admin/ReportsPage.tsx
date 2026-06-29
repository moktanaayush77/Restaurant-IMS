import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Download, Receipt, ShoppingBag, TrendingUp, Wallet } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState } from '../../components/EmptyState'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/toast'
import { cn } from '../../lib/cn'
import { formatMoney } from '../../lib/format'
import { useBranding } from '../settings/useBranding'
import type { SalesReport } from '../../types'
import { downloadSalesCsv, useSalesReport, type ReportPeriod } from './reportsHooks'
import { useStaffMealsReport } from '../orders/hooks'

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'year', label: 'This year' },
]

export function ReportsPage() {
  const toast = useToast()
  const { data: branding } = useBranding()
  const symbol = branding?.currency_symbol ?? 'Rs'
  const [period, setPeriod] = useState<ReportPeriod>('30d')
  const { data: report, isLoading } = useSalesReport(period)
  const [exporting, setExporting] = useState(false)

  async function exportCsv() {
    setExporting(true)
    try {
      await downloadSalesCsv(period)
    } catch {
      toast('Export failed.', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        subtitle="Income and sales analytics"
        actions={
          <Button variant="secondary" onClick={exportCsv} loading={exporting}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <div className="px-6 py-6 md:px-8">
        <div className="mb-6 inline-flex rounded-lg border border-ink-200 bg-surface-raised p-1 shadow-card">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                period === p.value ? 'bg-clay-600 text-white' : 'text-ink-600 hover:bg-ink-100',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {isLoading || !report ? (
          <div className="grid place-items-center py-24">
            <Spinner className="h-7 w-7 text-clay-500" />
          </div>
        ) : report.totals.orders === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No sales in this period"
            description="Paid bills will show up here as income and sales breakdowns."
          />
        ) : (
          <ReportBody report={report} symbol={symbol} />
        )}

        {/* Staff meals — shown regardless of paid-sales activity. */}
        <StaffMealsCard period={period} symbol={symbol} />
      </div>
    </>
  )
}

function StaffMealsCard({ period, symbol }: { period: ReportPeriod; symbol: string }) {
  const { data } = useStaffMealsReport(period)
  if (!data) return null
  return (
    <Card className="mt-6 p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="eyebrow text-ink-400">Staff meals</p>
          <h3 className="mt-1 font-display text-lg text-ink-900">To deduct from salary</h3>
        </div>
        <span className="nums font-display text-xl text-ink-900">
          {formatMoney(data.grand_total, symbol)}
        </span>
      </div>
      {!data.rows.length ? (
        <p className="py-6 text-center text-sm text-ink-400">No staff meals in this period.</p>
      ) : (
        <ul className="mt-3 divide-y divide-ink-100">
          {data.rows.map((r, i) => (
            <li key={i} className="flex items-baseline py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-800">{r.staff}</p>
                <p className="nums text-xs text-ink-400">
                  {r.orders} order{r.orders !== 1 ? 's' : ''}
                </p>
              </div>
              <span className="leader" aria-hidden="true" />
              <span className="nums text-sm font-semibold text-ink-900">
                {formatMoney(r.total, symbol)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ReportBody({ report, symbol }: { report: SalesReport; symbol: string }) {
  const { totals } = report
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Wallet} label="Gross income" value={formatMoney(totals.gross, symbol)} primary />
        <Kpi icon={Receipt} label="Orders paid" value={String(totals.orders)} />
        <Kpi icon={ShoppingBag} label="Items sold" value={String(totals.items_sold)} />
        <Kpi icon={TrendingUp} label="Average bill" value={formatMoney(totals.avg_bill, symbol)} />
      </div>

      <Card className="p-5">
        <p className="eyebrow text-ink-400">Performance</p>
        <h3 className="mt-1 font-display text-lg text-ink-900">Daily income</h3>
        <DayChart data={report.by_day} symbol={symbol} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <BreakdownTable
          title="Top items"
          rows={report.by_item.map((r) => ({
            label: r.name,
            sub: `${r.quantity} sold`,
            value: formatMoney(r.revenue, symbol),
          }))}
        />
        <BreakdownTable
          title="By category"
          rows={report.by_category.map((r) => ({
            label: r.name,
            value: formatMoney(r.revenue, symbol),
          }))}
        />
        <BreakdownTable
          title="By waiter"
          rows={report.by_waiter.map((r) => ({
            label: r.waiter,
            sub: `${r.orders} orders`,
            value: formatMoney(r.revenue, symbol),
          }))}
        />
        <BreakdownTable
          title="By payment method"
          rows={report.by_payment.map((r) => ({
            label: methodLabel(r.method),
            sub: `${r.count} bills`,
            value: formatMoney(r.total, symbol),
          }))}
        />
      </div>

      <Card className="p-5">
        <h3 className="font-display text-lg text-ink-900">Tax & charges collected</h3>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
          <Mini label="Net sales" value={formatMoney(totals.net, symbol)} />
          <Mini label="Discounts" value={formatMoney(totals.discount, symbol)} />
          <Mini label="Service charge" value={formatMoney(totals.service_charge, symbol)} />
          <Mini label="VAT" value={formatMoney(totals.vat, symbol)} />
        </div>
      </Card>
    </div>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  primary,
}: {
  icon: typeof Wallet
  label: string
  value: string
  primary?: boolean
}) {
  return (
    <Card className={cn('p-5', primary && 'bg-clay-600 text-white')}>
      <Icon className={cn('h-5 w-5', primary ? 'text-clay-100' : 'text-clay-500')} />
      <p className={cn('eyebrow mt-3', primary ? 'text-clay-100' : 'text-ink-400')}>{label}</p>
      <p
        className={cn(
          'mt-1 font-display text-2xl nums',
          primary ? 'text-white' : 'text-ink-900',
        )}
      >
        {value}
      </p>
    </Card>
  )
}

function DayChart({ data, symbol }: { data: SalesReport['by_day']; symbol: string }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-ink-400">No data.</p>
  const max = Math.max(...data.map((d) => d.total), 1)
  return (
    <div className="mt-4 flex h-48 items-end gap-1.5 overflow-x-auto">
      {data.map((d) => (
        <div key={d.date} className="group flex min-w-[28px] flex-1 flex-col items-center gap-1.5">
          <div className="relative flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md bg-clay-400 transition-colors group-hover:bg-clay-600"
              style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }}
              title={`${formatMoney(d.total, symbol)} · ${d.orders} orders`}
            />
          </div>
          <span className="nums text-[10px] text-ink-400">{format(parseISO(d.date), 'd MMM')}</span>
        </div>
      ))}
    </div>
  )
}

function BreakdownTable({
  title,
  rows,
}: {
  title: string
  rows: { label: string; sub?: string; value: string }[]
}) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 font-display text-lg text-ink-900">{title}</h3>
      {!rows.length ? (
        <p className="py-6 text-center text-sm text-ink-400">No data.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {rows.map((r, i) => (
            <li key={i} className="flex items-baseline py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-800">{r.label}</p>
                {r.sub && <p className="nums text-xs text-ink-400">{r.sub}</p>}
              </div>
              <span className="leader" aria-hidden="true" />
              <span className="nums text-sm font-semibold text-ink-900">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow text-ink-400">{label}</p>
      <p className="nums mt-1 font-semibold text-ink-900">{value}</p>
    </div>
  )
}

function methodLabel(m: string): string {
  const map: Record<string, string> = {
    CASH: 'Cash',
    CARD: 'Card',
    ESEWA: 'eSewa',
    KHALTI: 'Khalti',
    BANK: 'Bank / QR',
    STAFF: 'Staff (salary)',
    OTHER: 'Other',
  }
  return map[m] ?? m
}

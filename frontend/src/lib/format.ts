/** Format a number/string amount as currency, e.g. formatMoney(180) -> "Rs 180.00". */
export function formatMoney(amount: number | string, symbol = 'Rs'): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  const safe = Number.isFinite(n) ? n : 0
  return `${symbol} ${safe.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** Minutes elapsed since an ISO timestamp (used for KDS wait-time colouring). */
export function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
}

import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { SalesReport } from '../../types'

export type ReportPeriod = 'today' | '7d' | '30d' | 'year'

export function useSalesReport(period: ReportPeriod) {
  return useQuery({
    queryKey: ['sales-report', period],
    queryFn: async () =>
      (await api.get<SalesReport>('/reports/sales/', { params: { period } })).data,
  })
}

/** Download the period's CSV using the authenticated axios client. */
export async function downloadSalesCsv(period: ReportPeriod) {
  const res = await api.get('/reports/sales/export/', {
    params: { period },
    responseType: 'blob',
  })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sales_${period}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

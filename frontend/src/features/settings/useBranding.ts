import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

export interface Branding {
  name: string
  address: string
  phone: string
  logo: string | null
  currency_code: string
  currency_symbol: string
}

export function useBranding() {
  return useQuery({
    queryKey: ['branding'],
    queryFn: async () => (await api.get<Branding>('/branding/')).data,
    staleTime: 5 * 60 * 1000,
  })
}

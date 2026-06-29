import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { RestaurantSettings } from '../../types'

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<RestaurantSettings>('/settings/')).data,
  })
}

/**
 * Update venue settings. A logo upload goes as multipart; plain field edits go
 * as JSON. Branding (logo/name shown in headers) is invalidated so it refreshes.
 */
export function useSaveSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      logo,
      ...fields
    }: Omit<Partial<RestaurantSettings>, 'logo'> & { logo?: File | null }) => {
      if (logo instanceof File) {
        const form = new FormData()
        Object.entries(fields).forEach(([k, v]) => {
          if (v !== undefined && v !== null) form.append(k, String(v))
        })
        form.append('logo', logo)
        return (
          await api.patch<RestaurantSettings>('/settings/', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        ).data
      }
      return (await api.patch<RestaurantSettings>('/settings/', fields)).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['branding'] })
    },
  })
}

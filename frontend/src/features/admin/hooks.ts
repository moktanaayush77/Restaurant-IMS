import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type {
  InventoryItem,
  MenuCategory,
  MenuItem,
  Paginated,
  RecipeComponent,
  Staff,
  StockTransaction,
  Table,
} from '../../types'

const ALL = { params: { page_size: 500 } }

/* ----------------------------- Tables ----------------------------- */
export function useTables() {
  return useQuery({
    queryKey: ['tables'],
    queryFn: async () => (await api.get<Paginated<Table>>('/tables/', ALL)).data.results,
  })
}

export function useSaveTable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (t: Partial<Table> & { id?: number }) =>
      t.id
        ? (await api.patch<Table>(`/tables/${t.id}/`, t)).data
        : (await api.post<Table>('/tables/', t)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tables'] }),
  })
}

export function useDeleteTable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/tables/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tables'] }),
  })
}

/* --------------------------- Categories --------------------------- */
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () =>
      (await api.get<Paginated<MenuCategory>>('/menu/categories/', ALL)).data.results,
  })
}

export function useSaveCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: Partial<MenuCategory> & { id?: number }) =>
      c.id
        ? (await api.patch<MenuCategory>(`/menu/categories/${c.id}/`, c)).data
        : (await api.post<MenuCategory>('/menu/categories/', c)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/menu/categories/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['items'] })
    },
  })
}

/* ------------------------------ Items ----------------------------- */
export function useItems() {
  return useQuery({
    queryKey: ['items'],
    queryFn: async () => (await api.get<Paginated<MenuItem>>('/menu/items/', ALL)).data.results,
  })
}

/** Items carry an optional image file, so writes go as multipart form data. */
export function useSaveItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      image,
      ...fields
    }: Omit<Partial<MenuItem>, 'image'> & { id?: number; image?: File | null }) => {
      const form = new FormData()
      Object.entries(fields).forEach(([k, v]) => {
        if (v !== undefined && v !== null) form.append(k, String(v))
      })
      if (image instanceof File) form.append('image', image)
      const cfg = { headers: { 'Content-Type': 'multipart/form-data' } }
      return id
        ? (await api.patch<MenuItem>(`/menu/items/${id}/`, form, cfg)).data
        : (await api.post<MenuItem>('/menu/items/', form, cfg)).data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/menu/items/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  })
}

/* ------------------------------ Staff ----------------------------- */
export function useStaff() {
  return useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await api.get<Paginated<Staff>>('/staff/', ALL)).data.results,
  })
}

export function useSaveStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: Partial<Staff> & { id?: number; pin?: string; password?: string }) =>
      id
        ? (await api.patch<Staff>(`/staff/${id}/`, body)).data
        : (await api.post<Staff>('/staff/', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })
}

export function useResetPin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, pin }: { id: number; pin: string }) =>
      api.post(`/staff/${id}/reset_pin/`, { pin }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })
}

export function useDeleteStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/staff/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })
}

/* ---------------------------- Inventory --------------------------- */
export function useInventory() {
  return useQuery({
    queryKey: ['inventory'],
    queryFn: async () =>
      (await api.get<Paginated<InventoryItem>>('/inventory/items/', ALL)).data.results,
  })
}

export function useSaveInventoryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: Partial<InventoryItem> & { id?: number }) =>
      i.id
        ? (await api.patch<InventoryItem>(`/inventory/items/${i.id}/`, i)).data
        : (await api.post<InventoryItem>('/inventory/items/', i)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  })
}

export function useDeleteInventoryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/inventory/items/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  })
}

export function useStockMove() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: number
      txn_type: string
      quantity: number
      reason?: string
    }) =>
      (
        await api.post<InventoryItem>(`/inventory/items/${input.id}/move/`, {
          txn_type: input.txn_type,
          quantity: input.quantity,
          reason: input.reason ?? '',
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['stock-ledger'] })
    },
  })
}

export function useStockLedger(itemId?: number) {
  return useQuery({
    enabled: itemId != null,
    queryKey: ['stock-ledger', itemId],
    queryFn: async () =>
      (
        await api.get<Paginated<StockTransaction>>('/inventory/transactions/', {
          params: { item: itemId, page_size: 100 },
        })
      ).data.results,
  })
}

/* ------------------------------ Recipes --------------------------- */
/** Inventory components consumed by one unit of a menu item (auto-deducted on sale). */
export function useRecipe(menuItemId?: number) {
  return useQuery({
    enabled: menuItemId != null,
    queryKey: ['recipe', menuItemId],
    queryFn: async () =>
      (
        await api.get<Paginated<RecipeComponent>>('/inventory/recipes/', {
          params: { menu_item: menuItemId, page_size: 200 },
        })
      ).data.results,
  })
}

export function useSaveRecipeComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: {
      id?: number
      menu_item: number
      inventory_item: number
      quantity_per_unit: number
    }) =>
      c.id
        ? (await api.patch<RecipeComponent>(`/inventory/recipes/${c.id}/`, c)).data
        : (await api.post<RecipeComponent>('/inventory/recipes/', c)).data,
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['recipe', v.menu_item] }),
  })
}

export function useDeleteRecipeComponent(menuItemId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/inventory/recipes/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipe', menuItemId] }),
  })
}

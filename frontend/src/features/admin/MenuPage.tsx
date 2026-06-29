import { useMemo, useRef, useState } from 'react'
import {
  Boxes,
  ImagePlus,
  Pencil,
  Plus,
  Soup,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState } from '../../components/EmptyState'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Switch } from '../../components/ui/Switch'
import { Textarea } from '../../components/ui/Textarea'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/toast'
import { apiError } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import { cn } from '../../lib/cn'
import type { MenuCategory, MenuItem } from '../../types'
import {
  useCategories,
  useDeleteItem,
  useDeleteRecipeComponent,
  useInventory,
  useItems,
  useRecipe,
  useSaveCategory,
  useSaveItem,
  useSaveRecipeComponent,
} from './hooks'

export function MenuPage() {
  const { data: categories, isLoading: catLoading } = useCategories()
  const { data: items, isLoading: itemLoading } = useItems()
  const [activeCat, setActiveCat] = useState<number | 'all'>('all')
  const [editItem, setEditItem] = useState<Partial<MenuItem> | null>(null)
  const [editCat, setEditCat] = useState<Partial<MenuCategory> | null>(null)
  const [deleteItem, setDeleteItem] = useState<MenuItem | null>(null)

  const visible = useMemo(
    () => (activeCat === 'all' ? items : items?.filter((i) => i.category === activeCat)),
    [items, activeCat],
  )

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Menu"
        subtitle="Categories, items, prices and availability"
        actions={
          <Button onClick={() => setEditItem({})} disabled={!categories?.length}>
            <Plus className="h-4 w-4" /> Add item
          </Button>
        }
      />
      <div className="grid gap-6 px-6 py-6 md:px-8 lg:grid-cols-[260px_1fr]">
        {/* Category rail */}
        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="eyebrow text-ink-400">Categories</span>
            <button
              onClick={() => setEditCat({})}
              className="grid h-7 w-7 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {catLoading ? (
            <Spinner />
          ) : (
            <div className="space-y-0.5">
              <CatRow
                label="All items"
                count={items?.length ?? 0}
                active={activeCat === 'all'}
                onClick={() => setActiveCat('all')}
              />
              {categories?.map((c) => (
                <CatRow
                  key={c.id}
                  label={c.name}
                  count={c.item_count}
                  active={activeCat === c.id}
                  inactive={!c.is_active}
                  onClick={() => setActiveCat(c.id)}
                  onEdit={() => setEditCat(c)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Items */}
        <div>
          {itemLoading ? (
            <div className="grid place-items-center py-20">
              <Spinner className="h-7 w-7 text-clay-500" />
            </div>
          ) : !categories?.length ? (
            <EmptyState
              icon={Soup}
              title="Start your menu"
              description="Create a category first (e.g. Momo, Beverages), then add items to it."
              action={
                <Button onClick={() => setEditCat({})}>
                  <Plus className="h-4 w-4" /> Add category
                </Button>
              }
            />
          ) : !visible?.length ? (
            <EmptyState
              icon={UtensilsCrossed}
              title="No items here yet"
              description="Add the first dish to this category."
              action={
                <Button onClick={() => setEditItem({})}>
                  <Plus className="h-4 w-4" /> Add item
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onEdit={() => setEditItem(item)}
                  onDelete={() => setDeleteItem(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {editItem && (
        <ItemForm item={editItem} categories={categories ?? []} onClose={() => setEditItem(null)} />
      )}
      {editCat && <CategoryForm category={editCat} onClose={() => setEditCat(null)} />}
      <DeleteItem item={deleteItem} onClose={() => setDeleteItem(null)} />
    </>
  )
}

function CatRow({
  label,
  count,
  active,
  inactive,
  onClick,
  onEdit,
}: {
  label: string
  count: number
  active: boolean
  inactive?: boolean
  onClick: () => void
  onEdit?: () => void
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
        active ? 'bg-clay-50 text-clay-700' : 'text-ink-600 hover:bg-ink-100',
      )}
    >
      <button onClick={onClick} className="flex flex-1 items-center justify-between text-left">
        <span className={cn('font-medium', inactive && 'text-ink-400 line-through')}>{label}</span>
        <span className="nums text-xs text-ink-400">{count}</span>
      </button>
      {onEdit && (
        <button
          onClick={onEdit}
          className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Pencil className="h-3.5 w-3.5 text-ink-400 hover:text-ink-700" />
        </button>
      )}
    </div>
  )
}

function ItemCard({
  item,
  onEdit,
  onDelete,
}: {
  item: MenuItem
  onEdit: () => void
  onDelete: () => void
}) {
  const save = useSaveItem()
  return (
    <Card className={cn('overflow-hidden', !item.is_available && 'opacity-70')}>
      <div className="flex">
        <div className="grid h-24 w-24 shrink-0 place-items-center bg-surface-sunk">
          {item.image ? (
            <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <Soup className="h-7 w-7 text-ink-300" />
          )}
        </div>
        <div className="flex flex-1 flex-col p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium leading-tight text-ink-900">{item.name}</p>
              {!item.is_available && (
                <Badge tone="neutral" className="mt-1.5">
                  Unavailable
                </Badge>
              )}
            </div>
            <div className="flex shrink-0 gap-0.5">
              <button
                onClick={onEdit}
                className="grid h-7 w-7 place-items-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="grid h-7 w-7 place-items-center rounded-md text-ink-400 hover:bg-danger-500/10 hover:text-danger-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="mt-auto flex items-center gap-2 pt-2">
            <span className="nums font-display font-semibold text-clay-700">
              {formatMoney(item.price)}
            </span>
            <span className="leader" />
            <Switch
              checked={item.is_available}
              onChange={(v) =>
                save.mutate({ id: item.id, is_available: v, category: item.category, name: item.name })
              }
            />
          </div>
        </div>
      </div>
    </Card>
  )
}

function ItemForm({
  item,
  categories,
  onClose,
}: {
  item: Partial<MenuItem>
  categories: MenuCategory[]
  onClose: () => void
}) {
  const save = useSaveItem()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const isNew = !item.id
  const [form, setForm] = useState({
    category: item.category ?? categories[0]?.id ?? 0,
    name: item.name ?? '',
    description: item.description ?? '',
    price: item.price ?? '',
    is_available: item.is_available ?? true,
  })
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(item.image ?? null)
  const [error, setError] = useState('')

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  async function submit() {
    if (!form.name.trim()) return setError('Item name is required.')
    if (!form.price || Number(form.price) <= 0) return setError('Enter a valid price.')
    try {
      await save.mutateAsync({ id: item.id, ...form, category: Number(form.category), image })
      toast(isNew ? 'Item added.' : 'Item updated.')
      onClose()
    } catch (e) {
      setError(apiError(e))
    }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Add menu item' : 'Edit menu item'}>
      <div className="space-y-4">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-ink-300 bg-surface-raised text-ink-400 hover:border-clay-400 hover:text-clay-500"
          >
            {preview ? (
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="h-6 w-6" />
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
          <div className="flex-1 space-y-4">
            <Input
              label="Name"
              value={form.name}
              error={error}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: Number(e.target.value) })}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Input
          label="Price (Rs)"
          type="number"
          min={0}
          step="0.01"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
        />
        <Textarea
          label="Description (optional)"
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <Switch
          checked={form.is_available}
          onChange={(v) => setForm({ ...form, is_available: v })}
          label="Available to order"
        />

        {isNew ? (
          <p className="rounded-lg bg-surface-sunk px-3 py-2 text-xs text-ink-500">
            Save the item first to link a recipe for automatic stock deduction.
          </p>
        ) : (
          <RecipeEditor menuItemId={item.id!} />
        )}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} loading={save.isPending}>
          {isNew ? 'Add item' : 'Save changes'}
        </Button>
      </div>
    </Modal>
  )
}

/**
 * Links a menu item to the inventory it consumes. Each component deducts
 * `quantity_per_unit × ordered quantity` from stock when the bill is paid.
 */
function RecipeEditor({ menuItemId }: { menuItemId: number }) {
  const { data: recipe } = useRecipe(menuItemId)
  const { data: inventory } = useInventory()
  const saveComp = useSaveRecipeComponent()
  const delComp = useDeleteRecipeComponent(menuItemId)
  const toast = useToast()

  const [invId, setInvId] = useState<number | ''>('')
  const [qty, setQty] = useState('')

  // Inventory items not already in the recipe.
  const available = (inventory ?? []).filter(
    (i) => i.is_active && !(recipe ?? []).some((c) => c.inventory_item === i.id),
  )

  async function add() {
    if (!invId || !qty || Number(qty) <= 0) return toast('Pick an item and quantity.', 'error')
    try {
      await saveComp.mutateAsync({
        menu_item: menuItemId,
        inventory_item: Number(invId),
        quantity_per_unit: Number(qty),
      })
      setInvId('')
      setQty('')
    } catch (e) {
      toast(apiError(e), 'error')
    }
  }

  return (
    <div className="rounded-lg border border-ink-200 bg-surface-sunk p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-700">
        <Boxes className="h-4 w-4 text-clay-500" /> Recipe / ingredients
      </div>

      {(recipe ?? []).length > 0 ? (
        <ul className="mb-3 space-y-1.5">
          {recipe!.map((c) => (
            <li key={c.id} className="flex items-baseline gap-2 text-sm">
              <span className="min-w-0 truncate text-ink-800">{c.inventory_item_name}</span>
              <span className="leader" />
              <span className="nums text-ink-500">
                {parseFloat(c.quantity_per_unit)} {c.unit}
              </span>
              <button
                type="button"
                onClick={() => delComp.mutate(c.id)}
                className="grid h-6 w-6 shrink-0 self-center place-items-center rounded text-ink-400 hover:bg-danger-500/10 hover:text-danger-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-xs text-ink-400">
          No ingredients linked. Stock won’t auto-deduct for this item.
        </p>
      )}

      {!inventory?.length ? (
        <p className="text-xs text-ink-400">Add stock items in Inventory to build a recipe.</p>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select
              label="Ingredient"
              value={invId}
              onChange={(e) => setInvId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Select…</option>
              {available.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.unit})
                </option>
              ))}
            </Select>
          </div>
          <div className="w-24">
            <Input
              label="Qty / unit"
              type="number"
              min={0}
              step="0.001"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <Button type="button" size="sm" onClick={add} loading={saveComp.isPending} className="mb-0.5">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

function CategoryForm({
  category,
  onClose,
}: {
  category: Partial<MenuCategory>
  onClose: () => void
}) {
  const save = useSaveCategory()
  const toast = useToast()
  const isNew = !category.id
  const [name, setName] = useState(category.name ?? '')
  const [isActive, setIsActive] = useState(category.is_active ?? true)
  const [error, setError] = useState('')

  async function submit() {
    if (!name.trim()) return setError('Category name is required.')
    try {
      await save.mutateAsync({ id: category.id, name: name.trim(), is_active: isActive })
      toast(isNew ? 'Category added.' : 'Category updated.')
      onClose()
    } catch (e) {
      setError(apiError(e))
    }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Add category' : 'Edit category'} size="sm">
      <div className="space-y-4">
        <Input
          label="Name"
          placeholder="e.g. Momo, Beverages"
          value={name}
          error={error}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <Switch checked={isActive} onChange={setIsActive} label="Active" />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} loading={save.isPending}>
          {isNew ? 'Add category' : 'Save'}
        </Button>
      </div>
    </Modal>
  )
}

function DeleteItem({ item, onClose }: { item: MenuItem | null; onClose: () => void }) {
  const del = useDeleteItem()
  const toast = useToast()
  async function confirm() {
    if (!item) return
    try {
      await del.mutateAsync(item.id)
      toast('Item deleted.')
      onClose()
    } catch (e) {
      toast(apiError(e), 'error')
    }
  }
  return (
    <ConfirmDialog
      open={!!item}
      onClose={onClose}
      onConfirm={confirm}
      title="Delete item"
      message={`Delete “${item?.name}” from the menu?`}
      confirmLabel="Delete"
      destructive
      loading={del.isPending}
    />
  )
}

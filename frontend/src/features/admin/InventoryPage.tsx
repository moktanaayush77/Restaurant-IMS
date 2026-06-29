import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState } from '../../components/EmptyState'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Switch } from '../../components/ui/Switch'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/toast'
import { apiError } from '../../lib/api'
import { cn } from '../../lib/cn'
import { formatMoney } from '../../lib/format'
import { useAuth } from '../auth/AuthContext'
import type { InventoryItem, StockTxnType } from '../../types'
import {
  useDeleteInventoryItem,
  useInventory,
  useSaveInventoryItem,
  useStockMove,
} from './hooks'

export function InventoryPage() {
  const { user } = useAuth()
  const canWrite = user?.role === 'ADMIN' // accountants get read-only inventory
  const { data: items, isLoading } = useInventory()
  const [editing, setEditing] = useState<Partial<InventoryItem> | null>(null)
  const [moving, setMoving] = useState<InventoryItem | null>(null)
  const [deleting, setDeleting] = useState<InventoryItem | null>(null)

  const lowCount = useMemo(() => (items ?? []).filter((i) => i.is_low && i.is_active).length, [items])

  return (
    <>
      <PageHeader
        eyebrow="Stock room"
        title="Inventory"
        subtitle={canWrite ? 'Stock levels, purchases and low-stock alerts' : 'Stock levels and low-stock alerts (read-only)'}
        actions={
          canWrite ? (
            <Button onClick={() => setEditing({})}>
              <Plus className="h-4 w-4" /> Add item
            </Button>
          ) : undefined
        }
      />
      <div className="px-6 py-6 md:px-8">
        {lowCount > 0 && (
          <Card className="mb-5 flex items-center gap-3 border-warn-500/40 bg-warn-500/5 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-warn-500/15 text-warn-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <p className="text-sm text-ink-700">
              <span className="nums font-semibold">{lowCount}</span> item{lowCount > 1 ? 's are' : ' is'} at
              or below reorder level.
            </p>
          </Card>
        )}

        {isLoading ? (
          <div className="grid place-items-center py-20">
            <Spinner className="h-7 w-7 text-clay-500" />
          </div>
        ) : !items?.length ? (
          <EmptyState
            icon={Boxes}
            title="No stock items yet"
            description="Add ingredients and supplies to track their levels."
            action={
              canWrite ? (
                <Button onClick={() => setEditing({})}>
                  <Plus className="h-4 w-4" /> Add item
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-200 bg-surface-sunk text-left text-ink-500">
                <tr className="text-[0.65rem] font-semibold uppercase tracking-[0.12em]">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">On hand</th>
                  <th className="px-4 py-3">Reorder at</th>
                  <th className="px-4 py-3">Unit cost</th>
                  {canWrite && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {items.map((it) => (
                  <tr key={it.id} className={cn('hover:bg-ink-50/60', !it.is_active && 'opacity-50')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink-900">{it.name}</span>
                        {it.is_low && it.is_active && <Badge tone="warn">Low</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-700">
                      <span className="nums">{trimQty(it.quantity)}</span> {it.unit}
                    </td>
                    <td className="px-4 py-3 text-ink-500">
                      <span className="nums">{trimQty(it.reorder_level)}</span> {it.unit}
                    </td>
                    <td className="px-4 py-3 text-ink-500 nums">{formatMoney(it.unit_cost)}</td>
                    {canWrite && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setMoving(it)}
                            title="Adjust stock"
                            className="grid h-8 w-8 place-items-center rounded-lg text-clay-600 hover:bg-clay-50"
                          >
                            <SlidersHorizontal className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditing(it)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleting(it)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-danger-500/10 hover:text-danger-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {editing && <ItemForm item={editing} onClose={() => setEditing(null)} />}
      {moving && <StockMoveModal item={moving} onClose={() => setMoving(null)} />}
      <DeleteItem item={deleting} onClose={() => setDeleting(null)} />
    </>
  )
}

function trimQty(q: string): string {
  return parseFloat(q).toString()
}

function ItemForm({ item, onClose }: { item: Partial<InventoryItem>; onClose: () => void }) {
  const save = useSaveInventoryItem()
  const toast = useToast()
  const isNew = !item.id
  const [form, setForm] = useState({
    name: item.name ?? '',
    unit: item.unit ?? 'pcs',
    quantity: item.quantity ?? '0',
    reorder_level: item.reorder_level ?? '0',
    unit_cost: item.unit_cost ?? '0',
    is_active: item.is_active ?? true,
  })
  const [error, setError] = useState('')

  async function submit() {
    if (!form.name.trim()) return setError('Item name is required.')
    try {
      await save.mutateAsync({ id: item.id, ...form })
      toast(isNew ? 'Item added.' : 'Item updated.')
      onClose()
    } catch (e) {
      setError(apiError(e))
    }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Add stock item' : 'Edit stock item'}>
      <div className="space-y-4">
        <Input
          label="Name"
          placeholder="e.g. Chicken, Cooking oil"
          value={form.name}
          error={error}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Unit"
            placeholder="kg, ltr, pcs"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          />
          {isNew && (
            <Input
              label="Opening quantity"
              type="number"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Reorder level"
            type="number"
            value={form.reorder_level}
            onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
          />
          <Input
            label="Unit cost"
            type="number"
            value={form.unit_cost}
            onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
          />
        </div>
        <Switch
          checked={form.is_active}
          onChange={(v) => setForm({ ...form, is_active: v })}
          label="Active"
        />
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

const MOVES: { value: StockTxnType; label: string; icon: typeof ArrowUpCircle }[] = [
  { value: 'IN', label: 'Stock in', icon: ArrowUpCircle },
  { value: 'OUT', label: 'Stock out', icon: ArrowDownCircle },
  { value: 'ADJUST', label: 'Set count', icon: SlidersHorizontal },
]

function StockMoveModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const move = useStockMove()
  const toast = useToast()
  const [type, setType] = useState<StockTxnType>('IN')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')

  async function submit() {
    const n = parseFloat(qty)
    if (!Number.isFinite(n) || n < 0) return toast('Enter a valid quantity.', 'error')
    try {
      await move.mutateAsync({ id: item.id, txn_type: type, quantity: n, reason })
      toast('Stock updated.')
      onClose()
    } catch (e) {
      toast(apiError(e), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title={`Adjust ${item.name}`} description={`On hand: ${trimQty(item.quantity)} ${item.unit}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {MOVES.map((m) => (
            <button
              key={m.value}
              onClick={() => setType(m.value)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-sm transition-colors',
                type === m.value
                  ? 'border-clay-400 bg-clay-50 text-clay-700'
                  : 'border-ink-200 bg-surface-raised text-ink-600 hover:bg-ink-50',
              )}
            >
              <m.icon className="h-5 w-5" />
              {m.label}
            </button>
          ))}
        </div>
        <Input
          label={type === 'ADJUST' ? `New count (${item.unit})` : `Quantity (${item.unit})`}
          type="number"
          min={0}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <Input
          label="Reason / note"
          placeholder={type === 'IN' ? 'e.g. Supplier delivery' : 'e.g. Wastage'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} loading={move.isPending}>
          Record
        </Button>
      </div>
    </Modal>
  )
}

function DeleteItem({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  const del = useDeleteInventoryItem()
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
      title="Delete stock item"
      message={`Delete “${item?.name}”? Its movement history goes too.`}
      confirmLabel="Delete"
      destructive
      loading={del.isPending}
    />
  )
}

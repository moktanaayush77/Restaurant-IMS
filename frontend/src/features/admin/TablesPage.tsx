import { useState } from 'react'
import { Armchair, Pencil, Plus, Table2, Trash2, Users } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState } from '../../components/EmptyState'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Switch } from '../../components/ui/Switch'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/toast'
import { apiError } from '../../lib/api'
import type { Table } from '../../types'
import { useDeleteTable, useSaveTable, useTables } from './hooks'

const STATUS_TONE = { FREE: 'success', OCCUPIED: 'warn', BILLING: 'clay' } as const

export function TablesPage() {
  const { data: tables, isLoading } = useTables()
  const [editing, setEditing] = useState<Partial<Table> | null>(null)
  const [deleting, setDeleting] = useState<Table | null>(null)

  return (
    <>
      <PageHeader
        eyebrow="Floor plan"
        title="Tables"
        subtitle="Floor layout — normal tables and cabins"
        actions={
          <Button onClick={() => setEditing({})}>
            <Plus className="h-4 w-4" /> Add table
          </Button>
        }
      />
      <div className="px-6 py-6 md:px-8">
        {isLoading ? (
          <div className="grid place-items-center py-20">
            <Spinner className="h-7 w-7 text-clay-500" />
          </div>
        ) : !tables?.length ? (
          <EmptyState
            icon={Table2}
            title="No tables yet"
            description="Add your first table or cabin to start taking orders."
            action={
              <Button onClick={() => setEditing({})}>
                <Plus className="h-4 w-4" /> Add table
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tables.map((t) => (
              <Card key={t.id} className={t.is_active ? 'p-4' : 'p-4 opacity-60'}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-clay-50 text-clay-600">
                      {t.table_type === 'CABIN' ? (
                        <Armchair className="h-5 w-5" />
                      ) : (
                        <Table2 className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-ink-900 nums">{t.name}</p>
                      <p className="text-xs text-ink-400">{t.section || 'No section'}</p>
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[t.status]}>{t.status.toLowerCase()}</Badge>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-ink-200 pt-3">
                  <span className="inline-flex items-center gap-1 text-sm text-ink-500">
                    <Users className="h-4 w-4" /> <span className="nums">{t.capacity}</span> seats
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditing(t)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleting(t)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-danger-500/10 hover:text-danger-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {editing && <TableForm table={editing} onClose={() => setEditing(null)} />}
      <DeleteTable table={deleting} onClose={() => setDeleting(null)} />
    </>
  )
}

function TableForm({ table, onClose }: { table: Partial<Table>; onClose: () => void }) {
  const save = useSaveTable()
  const toast = useToast()
  const isNew = !table.id
  const [form, setForm] = useState({
    name: table.name ?? '',
    table_type: table.table_type ?? 'NORMAL',
    section: table.section ?? '',
    capacity: table.capacity ?? 4,
    is_active: table.is_active ?? true,
  })
  const [error, setError] = useState('')

  async function submit() {
    if (!form.name.trim()) return setError('Table name is required.')
    try {
      await save.mutateAsync({ id: table.id, ...form, capacity: Number(form.capacity) })
      toast(isNew ? 'Table added.' : 'Table updated.')
      onClose()
    } catch (e) {
      setError(apiError(e))
    }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Add table' : 'Edit table'}>
      <div className="space-y-4">
        <Input
          label="Name"
          placeholder="e.g. T5 or Cabin 3"
          value={form.name}
          error={error}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Type"
            value={form.table_type}
            onChange={(e) => setForm({ ...form, table_type: e.target.value as Table['table_type'] })}
          >
            <option value="NORMAL">Normal</option>
            <option value="CABIN">Cabin</option>
          </Select>
          <Input
            label="Capacity"
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
          />
        </div>
        <Input
          label="Section / floor"
          placeholder="e.g. Ground Floor"
          value={form.section}
          onChange={(e) => setForm({ ...form, section: e.target.value })}
        />
        <Switch
          checked={form.is_active}
          onChange={(v) => setForm({ ...form, is_active: v })}
          label="Active (available for seating)"
        />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} loading={save.isPending}>
          {isNew ? 'Add table' : 'Save changes'}
        </Button>
      </div>
    </Modal>
  )
}

function DeleteTable({ table, onClose }: { table: Table | null; onClose: () => void }) {
  const del = useDeleteTable()
  const toast = useToast()
  async function confirm() {
    if (!table) return
    try {
      await del.mutateAsync(table.id)
      toast('Table deleted.')
      onClose()
    } catch (e) {
      toast(apiError(e), 'error')
    }
  }
  return (
    <ConfirmDialog
      open={!!table}
      onClose={onClose}
      onConfirm={confirm}
      title="Delete table"
      message={`Delete “${table?.name}”? This can't be undone.`}
      confirmLabel="Delete"
      destructive
      loading={del.isPending}
    />
  )
}

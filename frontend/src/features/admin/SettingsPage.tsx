import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Save } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/toast'
import { apiError } from '../../lib/api'
import { useSaveSettings, useSettings } from '../settings/hooks'

export function SettingsPage() {
  const { data, isLoading } = useSettings()
  const save = useSaveSettings()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    pan_vat_no: '',
    currency_code: 'NPR',
    currency_symbol: 'Rs',
    vat_percent: '0',
    service_charge_percent: '0',
  })
  const [logo, setLogo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Hydrate the form once settings load.
  useEffect(() => {
    if (!data) return
    setForm({
      name: data.name,
      address: data.address,
      phone: data.phone,
      pan_vat_no: data.pan_vat_no,
      currency_code: data.currency_code,
      currency_symbol: data.currency_symbol,
      vat_percent: data.vat_percent,
      service_charge_percent: data.service_charge_percent,
    })
    setPreview(data.logo)
  }, [data])

  function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setLogo(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  async function submit() {
    if (!form.name.trim()) return setError('Restaurant name is required.')
    setError('')
    try {
      await save.mutateAsync({ ...form, logo })
      toast('Settings saved.')
      setLogo(null)
    } catch (e) {
      setError(apiError(e))
    }
  }

  if (isLoading) {
    return (
      <>
        <PageHeader
          eyebrow="Configuration"
          title="Settings"
          subtitle="Restaurant details and billing rates"
        />
        <div className="grid place-items-center py-24">
          <Spinner className="h-7 w-7 text-clay-500" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        subtitle="Restaurant details and billing rates"
        actions={
          <Button onClick={submit} loading={save.isPending}>
            <Save className="h-4 w-4" /> Save changes
          </Button>
        }
      />
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-6 md:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Restaurant identity</CardTitle>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="flex gap-4">
              <div className="flex shrink-0 flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-ink-300 bg-surface-raised text-ink-400 transition-colors hover:border-clay-400 hover:text-clay-500"
                >
                  {preview ? (
                    <img src={preview} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <ImagePlus className="h-6 w-6" />
                  )}
                </button>
                <span className="eyebrow text-ink-400">Logo</span>
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickLogo} />
              <div className="flex-1 space-y-4">
                <Input
                  label="Name"
                  value={form.name}
                  error={error}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Input
                  label="Phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <Input
              label="Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <Input
              label="PAN / VAT number"
              value={form.pan_vat_no}
              hint="Printed on bills for tax purposes."
              onChange={(e) => setForm({ ...form, pan_vat_no: e.target.value })}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing</CardTitle>
          </CardHeader>
          <CardBody className="space-y-6">
            <section className="space-y-3">
              <p className="eyebrow text-ink-500">Currency</p>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Currency code"
                  value={form.currency_code}
                  onChange={(e) => setForm({ ...form, currency_code: e.target.value })}
                />
                <Input
                  label="Currency symbol"
                  value={form.currency_symbol}
                  onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })}
                />
              </div>
            </section>
            <section className="space-y-3">
              <p className="eyebrow text-ink-500">Tax &amp; charges</p>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="VAT (%)"
                  type="number"
                  min={0}
                  step="0.01"
                  className="nums"
                  value={form.vat_percent}
                  hint="Applied after service charge."
                  onChange={(e) => setForm({ ...form, vat_percent: e.target.value })}
                />
                <Input
                  label="Service charge (%)"
                  type="number"
                  min={0}
                  step="0.01"
                  className="nums"
                  value={form.service_charge_percent}
                  hint="Applied to the discounted subtotal."
                  onChange={(e) => setForm({ ...form, service_charge_percent: e.target.value })}
                />
              </div>
            </section>
            <p className="rounded-lg bg-surface-sunk px-3 py-2 text-xs text-ink-500">
              These rates apply to <strong>new</strong> bills only. Existing bills keep the rate
              they were generated with.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  )
}

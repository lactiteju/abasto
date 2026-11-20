import { ArrowLeftRightIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { LargeDialog } from '#/components/large-dialog'
import { Button } from '#/components/ui/button'
import { useActionRunner } from '#/hooks/use-action-runner'
import { unwrap } from '#/lib/boundary'
import { ActionButton } from '#/modules/inventory/components/action-button'
import {
  Field,
  FieldSelect,
} from '#/modules/inventory/components/form-controls'
import { FormError } from '#/modules/inventory/components/info-blocks'
import { OwnerTransferTable } from '#/modules/transfers/components/owner-transfer-table'
import {
  summarizeTransfer,
  transferLines,
} from '#/modules/transfers/lib/owner-transfer-draft'
import type { BoxQuantities } from '#/modules/transfers/lib/owner-transfer-draft'
import {
  transferableBoxesFn,
  transferBoxesFn,
} from '#/modules/transfers/server/transfers'
import type { TransferableProduct } from '#/modules/transfers/services/owner-transfer'

const buttonClass =
  'h-auto min-h-[44px] gap-[9px] rounded-[9px] bg-primary px-[17px] py-2.5 text-sm font-[650] text-brand-ink hover:bg-brand-hover disabled:opacity-45'

type Warehouses = ReadonlyArray<{ id: string; name: string }>

/** Owner-only "Traspasar": immediate transfer in whole boxes between warehouses. */
export function OwnerTransferDialog({
  warehouses,
}: {
  warehouses: Warehouses
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        className={buttonClass}
        onClick={() => setOpen(true)}
      >
        <ArrowLeftRightIcon size={17} aria-hidden />
        Traspasar
      </Button>
      {open && (
        <OwnerTransferPanel
          warehouses={warehouses}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function OwnerTransferPanel({
  warehouses,
  onClose,
}: {
  warehouses: Warehouses
  onClose: () => void
}) {
  const run = useActionRunner()
  const [from, setFrom] = useState(warehouses.at(0)?.id ?? '')
  const [to, setTo] = useState(warehouses.at(1)?.id ?? '')
  const [quantities, setQuantities] = useState<BoxQuantities>({})
  const [options, setOptions] = useState<Array<TransferableProduct>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Products with whole boxes available in the chosen origin.
  useEffect(() => {
    if (!from) return
    let current = true
    setLoading(true)
    setOptions([])
    setQuantities({})
    transferableBoxesFn({ data: { warehouseId: from } })
      .then((result) => current && setOptions(unwrap(result)))
      .catch(() => current && setError('No pudimos cargar los productos.'))
      .finally(() => current && setLoading(false))
    return () => {
      current = false
    }
  }, [from])

  function changeFrom(next: string) {
    setFrom(next)
    if (next === to)
      setTo(warehouses.find((item) => item.id !== next)?.id ?? '')
  }

  const lines = transferLines(quantities)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (from === to) return setError('Elige un destino distinto del origen.')
    if (!lines.length)
      return setError('Indica las cajas de al menos un producto.')
    setError(null)
    await run(
      () =>
        transferBoxesFn({
          data: { fromWarehouseId: from, toWarehouseId: to, lines },
        }),
      { success: 'Traspaso realizado.', onSuccess: onClose },
    )
  }

  return (
    <LargeDialog
      full
      title="Traspasar cajas"
      description="Las cajas salen del origen y llegan al destino de inmediato."
      onClose={onClose}
    >
      <div className="grid gap-3 sm:grid-cols-2 md:max-w-2xl">
        <Field label="Origen">
          <FieldSelect
            value={from}
            onChange={(event) => changeFrom(event.target.value)}
          >
            {warehouses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </FieldSelect>
        </Field>
        <Field label="Destino">
          <FieldSelect
            value={to}
            onChange={(event) => setTo(event.target.value)}
          >
            {warehouses
              .filter((item) => item.id !== from)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </FieldSelect>
        </Field>
      </div>
      <OwnerTransferTable
        products={options}
        loading={loading}
        quantities={quantities}
        onChange={(productId, boxes) =>
          setQuantities((current) => ({ ...current, [productId]: boxes }))
        }
      />
      <form
        className="grid gap-3 border-t border-[#f4eee8] pt-4"
        onSubmit={(event) => void submit(event)}
      >
        {error && <FormError>{error}</FormError>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <strong className="text-sm">{summarizeTransfer(lines)}</strong>
          <div className="flex gap-3">
            <ActionButton type="button" onClick={onClose}>
              Cancelar
            </ActionButton>
            <ActionButton tone="primary" type="submit" disabled={run.pending}>
              {run.pending ? 'Traspasando…' : 'Traspasar'}
            </ActionButton>
          </div>
        </div>
      </form>
    </LargeDialog>
  )
}

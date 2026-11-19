import { ArrowLeftRightIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { useActionRunner } from '#/hooks/use-action-runner'
import { unwrap } from '#/lib/boundary'
import { FieldSelect } from '#/modules/inventory/components/form-controls'
import {
  transferableBoxesFn,
  transferBoxesFn,
} from '#/modules/transfers/server/transfers'
import type { TransferableProduct } from '#/modules/transfers/services/owner-transfer'

const buttonClass =
  'h-auto min-h-[44px] gap-[9px] rounded-[9px] bg-primary px-[17px] py-2.5 text-sm font-[650] text-brand-ink hover:bg-brand-hover disabled:opacity-45'

type Props = { warehouses: ReadonlyArray<{ id: string; name: string }> }

/** Owner-only "Traspasar": immediate transfer in whole boxes between warehouses. */
export function OwnerTransferDialog({ warehouses }: Props) {
  const run = useActionRunner()
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(warehouses.at(0)?.id ?? '')
  const [to, setTo] = useState(warehouses.at(1)?.id ?? '')
  const [productId, setProductId] = useState('')
  const [boxes, setBoxes] = useState('')
  const [options, setOptions] = useState<Array<TransferableProduct>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Products with whole boxes available in the chosen origin.
  useEffect(() => {
    if (!open || !from) return
    let current = true
    setLoading(true)
    transferableBoxesFn({ data: { warehouseId: from } })
      .then((result) => {
        if (!current) return
        setOptions(unwrap(result))
        setProductId('')
      })
      .catch(() => current && setError('No pudimos cargar los productos.'))
      .finally(() => current && setLoading(false))
    return () => {
      current = false
    }
  }, [open, from])

  function onOpenChange(next: boolean) {
    setOpen(next)
    setError(null)
    if (next) {
      setFrom(warehouses.at(0)?.id ?? '')
      setTo(warehouses.at(1)?.id ?? '')
      setBoxes('')
    }
  }

  function changeFrom(next: string) {
    setFrom(next)
    if (next === to)
      setTo(warehouses.find((item) => item.id !== next)?.id ?? '')
  }

  const selected = options.find((item) => item.productId === productId)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const count = Number(boxes)
    if (from === to) return setError('Elige un destino distinto del origen.')
    if (!productId) return setError('Elige el producto.')
    if (!boxes.trim() || !Number.isInteger(count) || count < 1) {
      return setError('Indica un número entero de cajas, de 1 en adelante.')
    }
    if (selected && count > selected.boxes) {
      return setError(`Solo hay ${selected.boxes} cajas disponibles.`)
    }
    setError(null)
    await run(
      () =>
        transferBoxesFn({
          data: {
            fromWarehouseId: from,
            toWarehouseId: to,
            productId,
            boxes: count,
          },
        }),
      {
        success: 'Traspaso realizado.',
        onSuccess: () => setOpen(false),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" className={buttonClass}>
          <ArrowLeftRightIcon size={17} aria-hidden />
          Traspasar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100vw-24px)] rounded-2xl bg-white p-[23px] md:max-w-[430px] md:p-[29px]">
        <DialogHeader>
          <DialogTitle>Traspasar cajas</DialogTitle>
          <DialogDescription>
            Las cajas salen del origen y llegan al destino de inmediato.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="transfer-from">Origen</Label>
            <FieldSelect
              id="transfer-from"
              value={from}
              onChange={(event) => changeFrom(event.target.value)}
            >
              {warehouses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </FieldSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="transfer-to">Destino</Label>
            <FieldSelect
              id="transfer-to"
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
          </div>
          <div className="grid gap-2">
            <Label htmlFor="transfer-product">Producto</Label>
            <FieldSelect
              id="transfer-product"
              value={productId}
              disabled={loading || !options.length}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">
                {loading
                  ? 'Cargando…'
                  : options.length
                    ? 'Elige un producto'
                    : 'Sin cajas disponibles en el origen'}
              </option>
              {options.map((item) => (
                <option key={item.productId} value={item.productId}>
                  {item.name} — {item.boxes}{' '}
                  {item.boxes === 1 ? 'caja disponible' : 'cajas disponibles'}
                </option>
              ))}
            </FieldSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="transfer-boxes">Cajas</Label>
            <Input
              id="transfer-boxes"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              max={selected?.boxes}
              value={boxes}
              onChange={(event) => setBoxes(event.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="ghost"
            disabled={run.pending}
            className={buttonClass}
          >
            {run.pending ? 'Traspasando…' : 'Traspasar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

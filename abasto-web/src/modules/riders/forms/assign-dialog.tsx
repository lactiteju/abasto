import { useMemo, useState } from 'react'

import { LargeDialog } from '#/components/large-dialog'
import { ActionButton } from '#/modules/inventory/components/action-button'
import {
  Field,
  FieldSelect,
} from '#/modules/inventory/components/form-controls'
import {
  FormError,
  SectionHelp,
  WarningInline,
} from '#/modules/inventory/components/info-blocks'
import { LoadProductsTable } from '#/modules/riders/components/load-products-table'
import { useRiderActions } from '#/modules/riders/hooks/use-rider-actions'
import { assignInputFromDraft } from '#/modules/riders/lib/assign-draft'
import type {
  AssignableProduct,
  AssignDraftLine,
} from '#/modules/riders/lib/assign-draft'
import {
  assignableSuppliers,
  defaultSupplierId,
} from '#/modules/riders/lib/assign-supplier-filter'
import { draftLines, summarizeLoad } from '#/modules/riders/lib/load-picker'
import {
  prefillFromSettlement,
  prefillNotices,
} from '#/modules/riders/lib/next-assignment'
import type { SettledLine } from '#/modules/riders/lib/next-assignment'
import type { LoadQuantities } from '#/modules/riders/lib/load-picker'
import type { AssignmentDetail } from '#/modules/riders/services/assignment-reads'
import type { Rider } from '#/modules/riders/services/riders'

type AssignDialogProps = {
  /** Active riders without an assignment on the road. */
  riders: ReadonlyArray<Rider>
  products: ReadonlyArray<AssignableProduct>
  onClose: () => void
  /** Rider chosen when it opens (e.g. preparing their next assignment). */
  initialRiderId?: string
  /** Lines the form starts with; editable and removable. */
  initialLines?: ReadonlyArray<AssignDraftLine>
  /** Heads-up shown above the lines (what was capped or left out). */
  notices?: ReadonlyArray<string>
  /** «Recargar»: add to this «En ruta» assignment instead of creating one. */
  recharge?: AssignmentDetail
  /**
   * By rider id, what came back from their last settled assignment: picking
   * the rider starts the form with it (until the user edits a quantity).
   */
  leftovers?: Readonly<Record<string, ReadonlyArray<SettledLine>>>
}

const toQuantities = (lines: ReadonlyArray<AssignDraftLine>): LoadQuantities =>
  Object.fromEntries(
    lines.map(({ productId, boxes, units }) => [productId, { boxes, units }]),
  )

/** Hands product to a rider: pick the rider, then boxes and/or units per product. */
export function AssignDialog({
  riders,
  products,
  onClose,
  initialRiderId,
  initialLines,
  notices = [],
  recharge,
  leftovers,
}: AssignDialogProps) {
  const actions = useRiderActions()
  const [riderId, setRiderId] = useState(
    recharge?.riderId ?? initialRiderId ?? riders.at(0)?.id ?? '',
  )
  const leftoverPrefill = (id: string) => {
    const back = leftovers?.[id]
    return back?.length ? prefillFromSettlement(back, products) : null
  }
  // Explicit lines win; otherwise the chosen rider's leftover, if any.
  const [prefill, setPrefill] = useState(() =>
    initialLines || recharge ? null : leftoverPrefill(riderId),
  )
  const startLines = initialLines ?? prefill?.lines ?? []
  const [quantities, setQuantities] = useState<LoadQuantities>(() =>
    toQuantities(startLines),
  )
  /** Once a quantity is typed, picking another rider no longer replaces it. */
  const [edited, setEdited] = useState(false)
  const shownNotices = [
    ...(prefill?.lines.length
      ? ['Se precargó lo que le sobró de su último reparto. Puedes cambiarlo.']
      : []),
    ...(prefill ? prefillNotices(prefill) : []),
    ...notices,
  ]

  function chooseRider(id: string) {
    setRiderId(id)
    if (edited || initialLines) return
    const next = leftoverPrefill(id)
    setPrefill(next)
    setQuantities(toQuantities(next?.lines ?? []))
  }

  // LALA first, unless a prefilled product would be hidden by it.
  const initialSupplierId = useMemo(() => {
    const lala = defaultSupplierId(assignableSuppliers(products))
    const hidden = startLines.some(
      (line) =>
        products.find((p) => p.productId === line.productId)?.supplierId !==
        lala,
    )
    return hidden ? '' : lala
    // Only the opening lines choose the starting filter.
  }, [products])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const lines = draftLines(quantities)

  async function submit() {
    const parsed = assignInputFromDraft(riderId, lines, products)
    if (!parsed.ok) return setError(parsed.message)
    setError(null)
    setPending(true)
    const result = recharge
      ? await actions.recharge({
          assignmentId: recharge.id,
          lines: parsed.value.lines,
        })
      : await actions.assign(parsed.value)
    setPending(false)
    if (result) onClose()
  }

  return (
    <LargeDialog
      full
      title={
        recharge ? `Recargar reparto de ${recharge.riderName}` : 'Nuevo reparto'
      }
      description={
        recharge
          ? 'El producto se aparta del almacén y se suma a este mismo reparto. No se vende ni se cobra hasta liquidar.'
          : 'El producto se aparta del almacén y queda en ruta. No se vende ni se cobra hasta liquidar.'
      }
      onClose={onClose}
    >
      <div className="grid gap-3">
        {recharge ? (
          <p className="flex flex-col gap-[7px] text-[13px] font-medium text-[#513f45]">
            Repartidor
            <span className="text-sm font-[650] text-[#442460]">
              {recharge.riderName}
            </span>
          </p>
        ) : (
          <div className="max-w-sm">
            <Field label="Repartidor">
              <FieldSelect
                value={riderId}
                onChange={(event) => chooseRider(event.target.value)}
              >
                <option value="">Elige al repartidor</option>
                {riders.map((rider) => (
                  <option key={rider.id} value={rider.id}>
                    {rider.name}
                  </option>
                ))}
              </FieldSelect>
            </Field>
          </div>
        )}
        {shownNotices.map((notice) => (
          <WarningInline key={notice} className="my-0">
            {notice}
          </WarningInline>
        ))}
        <SectionHelp className="my-0">
          Escribe cajas, unidades o ambas, por ejemplo 40 cajas y 20 unidades.
        </SectionHelp>
      </div>
      <LoadProductsTable
        products={products}
        allProducts={products}
        quantities={quantities}
        initialSupplierId={initialSupplierId}
        onChange={(productId, change) => {
          setEdited(true)
          setQuantities((current) => ({
            ...current,
            [productId]: {
              boxes: current[productId]?.boxes ?? '',
              units: current[productId]?.units ?? '',
              ...change,
            },
          }))
        }}
      />
      <form
        className="grid gap-3 border-t border-[#f4eee8] pt-4"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {error && <FormError>{error}</FormError>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <strong className="text-sm">{summarizeLoad(lines)}</strong>
          <div className="flex gap-3">
            <ActionButton type="button" onClick={onClose}>
              Cancelar
            </ActionButton>
            <ActionButton tone="primary" type="submit" disabled={pending}>
              {recharge ? 'Agregar a la ruta' : 'Asignar reparto'}
            </ActionButton>
          </div>
        </div>
      </form>
    </LargeDialog>
  )
}

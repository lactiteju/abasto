import { useState } from 'react'

import { cn } from '#/lib/utils/cn'
import { ActionButton } from '#/modules/counter/components/action-button'
import { CounterDialog } from '#/modules/counter/components/counter-dialog'
import {
  Field,
  FieldInput,
  FieldTextarea,
} from '#/modules/counter/components/form-controls'
import { useCashActions } from '#/modules/cash/hooks/use-cash-actions'
import {
  countedCash,
  differenceLabel,
  differenceTone,
} from '#/modules/cash/lib/cash-summary'
import { formatCents } from '#/modules/pricing/lib/money'
import type { CashSession } from '#/modules/cash/services/cash-ledger'

const differenceClass = {
  short: 'text-[#a1372e]',
  over: 'text-[#1f7a4d]',
  even: '',
}

type CashCloseDialogProps = {
  warehouseId: string
  /** Cash the drawer should hold now; shown as a reference, never prefilled. */
  expectedCents?: number
  onClose: () => void
}

/** Close: the expected cash is shown for reference; the count is typed by hand. */
export function CashCloseDialog({
  warehouseId,
  expectedCents,
  onClose,
}: CashCloseDialogProps) {
  const actions = useCashActions(warehouseId)
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [closed, setClosed] = useState<CashSession>()
  const counted = text.trim() ? countedCash(text) : null

  async function submit() {
    if (!counted?.ok) return
    await actions.close(counted.value, note, setClosed)
  }

  if (closed) {
    return (
      <CounterDialog
        title="Caja cerrada"
        description="Este es el resultado del corte."
        onClose={onClose}
      >
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt>Esperado</dt>
          <dd className="text-right">
            {formatCents(closed.expectedCents ?? 0)}
          </dd>
          <dt>Contado</dt>
          <dd className="text-right">
            {formatCents(closed.countedCents ?? 0)}
          </dd>
          <dt className="font-[650]">Diferencia</dt>
          <dd
            className={cn(
              'text-right font-[650]',
              differenceClass[differenceTone(closed.differenceCents ?? 0)],
            )}
          >
            {differenceLabel(closed.differenceCents ?? 0)}
          </dd>
          {closed.note && (
            <>
              <dt>Nota</dt>
              <dd className="text-right break-words">{closed.note}</dd>
            </>
          )}
        </dl>
        <div className="flex justify-end">
          <ActionButton tone="primary" onClick={onClose}>
            Listo
          </ActionButton>
        </div>
      </CounterDialog>
    )
  }

  return (
    <CounterDialog
      title="Cerrar caja"
      description="Cuenta el efectivo y escribe cuánto hay. Al cerrar verás la diferencia."
      onClose={onClose}
    >
      {expectedCents !== undefined && (
        <p className="flex items-baseline justify-between gap-3 rounded-lg bg-[#f7f2ee] px-3 py-2 text-sm text-[#5f4a51]">
          Efectivo esperado
          <strong className="text-base font-[650] text-[#3b2251] tabular-nums">
            {formatCents(expectedCents)}
          </strong>
        </p>
      )}
      <Field label="Efectivo contado (pesos)">
        <FieldInput
          inputMode="decimal"
          autoFocus
          placeholder="0.00"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </Field>
      {counted && !counted.ok && (
        <p className="text-sm text-[#a1372e]">{counted.message}</p>
      )}
      <Field label="Nota (opcional)">
        <FieldTextarea
          maxLength={500}
          placeholder="Explica una diferencia, por ejemplo: faltó cambio."
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      <div className="flex justify-end gap-3">
        <ActionButton onClick={onClose}>Cancelar</ActionButton>
        <ActionButton
          tone="primary"
          disabled={actions.pending || !counted?.ok}
          onClick={submit}
        >
          Cerrar caja
        </ActionButton>
      </div>
    </CounterDialog>
  )
}

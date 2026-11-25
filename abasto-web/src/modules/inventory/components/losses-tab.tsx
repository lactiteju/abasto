import { Trash2Icon } from 'lucide-react'
import { useState } from 'react'

import { ProductImage } from '#/components/product-image'
import { SearchBox } from '#/components/search-box'
import { EmptyPanel } from '#/modules/inventory/components/empty-panel'
import {
  ListBody,
  ListCell,
  ListHead,
  ListPanel,
  ListRow,
  ListTable,
} from '#/modules/inventory/components/list-panel'
import { Picker } from '#/modules/inventory/components/picker'
import { SectionRow } from '#/modules/inventory/components/section-row'
import { dateLabel, money, timeLabel } from '#/modules/inventory/lib/format'
import {
  filterLosses,
  lossMotive,
  lossMotiveFilters,
  lossPeriods,
  lossTotals,
} from '#/modules/inventory/lib/loss-ledger'
import type { LossPeriod, LossRow } from '#/modules/inventory/lib/loss-ledger'
import type { LossMovementRow } from '#/modules/inventory/services/stock-reads'

type LossesTabProps = {
  rows: ReadonlyArray<LossMovementRow>
  products: ReadonlyMap<
    string,
    { name: string; sku: string; imageUrl: string | null }
  >
  /** Business day (YYYY-MM-DD) the period filter counts from. */
  today: string
}

type Entry = LossRow & { imageUrl: string | null; row: LossMovementRow }

const pickerClass =
  'data-[size=default]:h-9 text-xs md:data-[size=default]:h-[43px] md:text-sm'

/** Mermas: the warehouse's `loss` movements, newest first, with filters and totals. */
export function LossesTab({ rows, products, today }: LossesTabProps) {
  const [query, setQuery] = useState('')
  const [motive, setMotive] = useState('Todos')
  const [period, setPeriod] = useState<LossPeriod>('all')

  const entries: Array<Entry> = rows.map((row) => {
    const product = products.get(row.productId)
    return {
      id: row.id,
      productName: product?.name ?? 'Producto',
      sku: product?.sku ?? '',
      imageUrl: product?.imageUrl ?? null,
      quantity: row.quantity,
      reason: row.reason,
      createdAt: row.createdAt,
      costCents: row.costCents,
      row,
    }
  })
  const visible = filterLosses(entries, { query, motive, period }, today)
  const totals = lossTotals(visible)
  const showCost = rows.some(({ costCents }) => costCents !== null)

  return (
    <>
      <SectionRow
        title="Mermas del almacén"
        description="Piezas dañadas, caducadas o dañadas en reparto que salieron del inventario."
      />
      <div className="mb-[15px] flex flex-wrap items-center gap-2.5 md:mb-[18px] md:flex-nowrap md:gap-3">
        <SearchBox
          label="Buscar en mermas"
          placeholder="Buscar por nombre o SKU..."
          value={query}
          onChange={setQuery}
        />
        <Picker
          label="Motivo"
          value={motive}
          onChange={setMotive}
          options={lossMotiveFilters}
          className={pickerClass}
        />
        <Picker
          label="Periodo"
          value={period}
          onChange={(value) => setPeriod(value as LossPeriod)}
          options={lossPeriods}
          className={pickerClass}
        />
      </div>
      {rows.length ? (
        <>
          <p className="mb-3 text-sm text-[#785e67]" aria-live="polite">
            <strong className="font-semibold">
              {totals.pieces} {totals.pieces === 1 ? 'pieza' : 'piezas'}
            </strong>
            {showCost && totals.hasCost && (
              <>
                {' · costo '}
                <strong className="font-semibold">
                  {money(totals.costCents / 100)}
                </strong>
              </>
            )}
            {' en '}
            {visible.length} {visible.length === 1 ? 'registro' : 'registros'}
          </p>
          {visible.length ? (
            <ListPanel scroll>
              <ListTable>
                <ListHead sticky>
                  {[
                    'Fecha',
                    'Producto',
                    'Piezas',
                    'Motivo',
                    'Lote',
                    'Registró',
                    ...(showCost ? ['Costo'] : []),
                  ]}
                </ListHead>
                <ListBody>
                  {visible.map((entry) => {
                    const created = new Date(entry.createdAt).toISOString()
                    const reason = lossMotive(entry.reason)
                    const { lotCode, expiresOn, actorName } = entry.row
                    return (
                      <ListRow key={entry.id}>
                        <ListCell className="whitespace-nowrap">
                          {dateLabel(created)}
                          <small className="block text-[#907e84]">
                            {timeLabel(created)}
                          </small>
                        </ListCell>
                        <ListCell>
                          <span className="flex items-center gap-3">
                            <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#faf9f7]">
                              <ProductImage
                                src={entry.imageUrl}
                                name={entry.productName}
                                className="size-full object-contain p-1 mix-blend-multiply"
                                placeholderClassName="size-5"
                              />
                            </span>
                            <span>
                              <strong>{entry.productName}</strong>
                              <small className="block text-[#907e84]">
                                {entry.sku}
                              </small>
                            </span>
                          </span>
                        </ListCell>
                        <ListCell>
                          <strong className="text-[#c35850] tabular-nums">
                            −{entry.quantity}
                          </strong>
                        </ListCell>
                        <ListCell>
                          {reason.label}
                          {reason.detail && (
                            <small className="block text-[#907e84]">
                              {reason.detail}
                            </small>
                          )}
                        </ListCell>
                        <ListCell>
                          {lotCode || '—'}
                          {expiresOn && (
                            <small className="block text-[#907e84]">
                              Caduca {dateLabel(expiresOn)}
                            </small>
                          )}
                        </ListCell>
                        <ListCell>{actorName}</ListCell>
                        {showCost && (
                          <ListCell className="tabular-nums">
                            {entry.costCents === null
                              ? '—'
                              : money(entry.costCents / 100)}
                          </ListCell>
                        )}
                      </ListRow>
                    )
                  })}
                </ListBody>
              </ListTable>
            </ListPanel>
          ) : (
            <EmptyPanel
              title="Sin resultados"
              description="Prueba con otra búsqueda, motivo o periodo."
              icon={Trash2Icon}
            />
          )}
        </>
      ) : (
        <EmptyPanel
          title="Sin mermas registradas"
          description="Cuando registres una merma desde Productos, o se liquide un reparto con piezas dañadas, aparecerá aquí."
          icon={Trash2Icon}
        />
      )}
    </>
  )
}

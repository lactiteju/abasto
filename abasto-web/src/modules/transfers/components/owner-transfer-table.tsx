import { useState } from 'react'

import { CellNote, DataTable, TableWrap, Td, Th } from '#/components/data-table'
import { ProductImage } from '#/components/product-image'
import { SearchBox } from '#/components/search-box'
import { cn } from '#/lib/utils/cn'
import { FieldInput } from '#/modules/inventory/components/form-controls'
import {
  boxesAvailableLabel,
  clampBoxes,
  transferLines,
  visibleTransferProducts,
} from '#/modules/transfers/lib/owner-transfer-draft'
import type { BoxQuantities } from '#/modules/transfers/lib/owner-transfer-draft'
import type { TransferableProduct } from '#/modules/transfers/services/owner-transfer'

type OwnerTransferTableProps = {
  products: ReadonlyArray<TransferableProduct>
  loading: boolean
  quantities: BoxQuantities
  onChange: (productId: string, boxes: string) => void
}

/**
 * Toolbar (search, «Solo agregados») plus the product table, as two siblings
 * so the large dialog grid gives the table the spare height.
 */
export function OwnerTransferTable({
  products,
  loading,
  quantities,
  onChange,
}: OwnerTransferTableProps) {
  const [query, setQuery] = useState('')
  const [onlyAdded, setOnlyAdded] = useState(false)
  const added = new Set(transferLines(quantities).map((line) => line.productId))
  const showOnlyAdded = onlyAdded && added.size > 0
  const visible = visibleTransferProducts(
    products,
    query,
    showOnlyAdded ? added : undefined,
  )
  const empty = loading
    ? 'Cargando…'
    : products.length
      ? 'Sin productos que coincidan'
      : 'Sin cajas disponibles en el origen'

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1">
          <SearchBox
            label="Buscar producto"
            placeholder="Buscar por nombre o SKU"
            value={query}
            onChange={setQuery}
          />
        </div>
        <button
          type="button"
          aria-pressed={showOnlyAdded}
          disabled={added.size === 0}
          className={cn(
            'min-h-[42px] rounded-[10px] border px-3.5 text-sm disabled:opacity-50',
            showOnlyAdded
              ? 'border-[#785e67] bg-[#785e67] text-white'
              : 'border-[#eee7e0] bg-white text-[#785e67] hover:bg-[#f4eef0]',
          )}
          onClick={() => setOnlyAdded((current) => !current)}
        >
          Solo agregados ({added.size})
        </button>
      </div>
      <TableWrap className="h-full min-h-[14rem] overflow-y-auto rounded-xl border border-[#f1ebe5]">
        <DataTable>
          <thead className="sticky top-0 z-10">
            <tr>
              <Th>Producto</Th>
              <Th>Cajas</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((product) => (
              <tr
                key={product.productId}
                className={
                  added.has(product.productId) ? 'bg-[#fbf7f3]' : undefined
                }
              >
                <Td>
                  <span className="flex items-stretch gap-3">
                    <span className="flex min-h-[72px] w-[72px] shrink-0 items-center justify-center self-stretch overflow-hidden rounded-lg bg-[#faf9f7]">
                      <ProductImage
                        src={product.imageUrl}
                        name={product.name}
                        className="size-full max-h-[96px] object-contain p-1 mix-blend-multiply"
                        placeholderClassName="size-7"
                      />
                    </span>
                    <span>
                      <strong className="font-semibold">{product.name}</strong>
                      <CellNote>{product.sku}</CellNote>
                      <CellNote>{boxesAvailableLabel(product.boxes)}</CellNote>
                    </span>
                  </span>
                </Td>
                <Td>
                  <FieldInput
                    inputMode="numeric"
                    aria-label={`Cajas de ${product.name}`}
                    placeholder="0"
                    className="w-20"
                    value={quantities[product.productId] ?? ''}
                    onChange={(event) =>
                      onChange(
                        product.productId,
                        clampBoxes(event.target.value, product.boxes),
                      )
                    }
                  />
                </Td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <Td colSpan={2} className="text-center text-[#907e84]">
                  {empty}
                </Td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </TableWrap>
    </>
  )
}

import { Button } from '#/components/ui/button'
import { useMemo, useState } from 'react'

import { DataTable, CellNote, TableWrap, Td, Th } from '#/components/data-table'
import { ProductImage } from '#/components/product-image'
import { SearchBox } from '#/components/search-box'
import { SupplierSelect } from '#/components/supplier-select'
import { cn } from '#/lib/utils/cn'
import { FieldInput } from '#/modules/inventory/components/form-controls'
import { assignableSuppliers } from '#/modules/riders/lib/assign-supplier-filter'
import {
  availabilityLabel,
  draftLines,
  productNote,
  visibleProducts,
} from '#/modules/riders/lib/load-picker'
import type { AssignableProduct } from '#/modules/riders/lib/assign-draft'
import type { LoadQuantities } from '#/modules/riders/lib/load-picker'

type LoadProductsTableProps = {
  /** Products the table lists (before search and supplier). */
  products: ReadonlyArray<AssignableProduct>
  /** Every assignable product, for the supplier options. */
  allProducts: ReadonlyArray<AssignableProduct>
  quantities: LoadQuantities
  onChange: (
    productId: string,
    change: Partial<{ boxes: string; units: string }>,
  ) => void
  initialSupplierId: string
}

/**
 * Toolbar (search, supplier, «Solo agregados») plus the product table, as two
 * siblings so the dialog grid gives the table the spare height.
 */
export function LoadProductsTable({
  products,
  allProducts,
  quantities,
  onChange,
  initialSupplierId,
}: LoadProductsTableProps) {
  const [query, setQuery] = useState('')
  const [supplierId, setSupplierId] = useState(initialSupplierId)
  const [onlyAdded, setOnlyAdded] = useState(false)
  const suppliers = useMemo(
    () => assignableSuppliers(allProducts),
    [allProducts],
  )
  const added = new Set(draftLines(quantities).map((line) => line.productId))
  const showOnlyAdded = onlyAdded && added.size > 0
  const visible = visibleProducts(products, {
    query,
    supplierId,
    onlyIds: showOnlyAdded ? added : undefined,
  })

  const quantityInput = (
    product: AssignableProduct,
    field: 'boxes' | 'units',
    label: string,
  ) => (
    <label className="grid gap-1 text-xs text-[#907e84]">
      {label}
      <FieldInput
        inputMode="numeric"
        aria-label={`${label} de ${product.name}`}
        placeholder="0"
        className="w-20"
        disabled={product.available <= 0}
        value={quantities[product.productId]?.[field] ?? ''}
        onChange={(event) =>
          onChange(product.productId, { [field]: event.target.value })
        }
      />
    </label>
  )

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
        {suppliers.length > 0 && (
          <SupplierSelect
            suppliers={suppliers}
            value={supplierId}
            onChange={setSupplierId}
          />
        )}
        <Button
          type="button"
          variant="outline"
          aria-pressed={showOnlyAdded}
          disabled={added.size === 0}
          className={cn(
            'h-auto min-h-[42px] rounded-[10px] px-3.5 text-sm font-normal',
            showOnlyAdded
              ? 'border-[#785e67] bg-[#785e67] text-white hover:bg-[#785e67]'
              : 'border-[#eee7e0] bg-white text-[#785e67] hover:bg-[#f4eef0]',
          )}
          onClick={() => setOnlyAdded((current) => !current)}
        >
          Solo agregados ({added.size})
        </Button>
      </div>
      <TableWrap className="h-full min-h-[14rem] overflow-y-auto rounded-xl border border-[#f1ebe5]">
        <DataTable>
          <thead className="sticky top-0 z-10">
            <tr>
              <Th>Producto</Th>
              <Th>Cantidad</Th>
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
                        src={product.imageUrl ?? null}
                        name={product.name}
                        className="size-full max-h-[96px] object-contain p-1 mix-blend-multiply"
                        placeholderClassName="size-7"
                      />
                    </span>
                    <span>
                      <strong className="font-semibold">{product.name}</strong>
                      <CellNote>{productNote(product)}</CellNote>
                      <CellNote>{availabilityLabel(product)}</CellNote>
                    </span>
                  </span>
                </Td>
                <Td>
                  <span className="flex gap-2">
                    {quantityInput(product, 'boxes', 'Cajas')}
                    {quantityInput(product, 'units', 'Unidades')}
                  </span>
                </Td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <Td colSpan={2} className="text-center text-[#907e84]">
                  Sin productos que coincidan
                </Td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </TableWrap>
    </>
  )
}

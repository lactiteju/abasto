import { NativeSelect } from '#/components/native-select'
import type { StoreWarehouse } from '#/modules/store/services/storefront'

type WarehousePickerProps = {
  warehouses: Array<StoreWarehouse>
  value: string
  onChange: (warehouseId: string) => void
}

/** Names the pickup warehouse. */
export function WarehousePicker({
  warehouses,
  value,
  onChange,
}: WarehousePickerProps) {
  return (
    <div className="st-plate grid gap-1.5 p-2.5 sm:grid-cols-[auto_auto_minmax(0,1fr)] sm:items-center sm:gap-x-4 sm:px-3 sm:py-2">
      <label htmlFor="warehouse" className="st-card sm:whitespace-nowrap">
        Recoges tu pedido en
      </label>
      <NativeSelect
        id="warehouse"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[10px] border-st-control bg-st-card px-3 text-[18px] font-semibold text-st-ink data-[size=default]:h-12 sm:min-w-72 sm:data-[size=default]:h-11"
      >
        {warehouses.map((warehouse) => (
          <option key={warehouse.id} value={warehouse.id}>
            {warehouse.name}
          </option>
        ))}
      </NativeSelect>
      <p className="text-[13px] leading-snug text-st-ink-soft sm:text-[14px]">
        Precios, existencias y hoja de surtido propios de este almacén.
      </p>
    </div>
  )
}

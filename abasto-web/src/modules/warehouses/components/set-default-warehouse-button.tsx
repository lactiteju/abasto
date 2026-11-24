import { StarIcon } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { useActionRunner } from '#/hooks/use-action-runner'
import { setDefaultWarehouseFn } from '#/modules/warehouses/server/warehouses'

/** Owner-only: "Marcar como predeterminado" on a warehouse card. */
export function SetDefaultWarehouseButton({
  warehouse,
}: {
  warehouse: { id: string; name: string }
}) {
  const run = useActionRunner()
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={run.pending}
      aria-label={`Marcar ${warehouse.name} como predeterminado`}
      onClick={() =>
        void run(() => setDefaultWarehouseFn({ data: { id: warehouse.id } }), {
          success: `${warehouse.name} es ahora el almacén predeterminado.`,
        })
      }
      className="h-auto min-h-[44px] gap-[7px] px-2 text-sm font-[650] text-ink-link hover:underline"
    >
      <StarIcon size={15} aria-hidden />
      Marcar como predeterminado
    </Button>
  )
}

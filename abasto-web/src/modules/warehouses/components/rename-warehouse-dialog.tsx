import { PencilIcon } from 'lucide-react'
import { useState } from 'react'
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
import { renameWarehouseFn } from '#/modules/warehouses/server/warehouses'

const buttonClass =
  'h-auto min-h-[44px] gap-[9px] rounded-[9px] bg-primary px-[17px] py-2.5 text-sm font-[650] text-brand-ink hover:bg-brand-hover disabled:opacity-45'

/** Owner-only: "Cambiar nombre" on a warehouse card. */
export function RenameWarehouseDialog({
  warehouse,
}: {
  warehouse: { id: string; name: string }
}) {
  const run = useActionRunner()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onOpenChange(next: boolean) {
    setOpen(next)
    setError(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get('name') ?? '')
    // Same rule as the server, so a blank name is explained without a request.
    if (!name.trim()) return setError('Escribe el nombre del almacén.')
    setError(null)
    await run(() => renameWarehouseFn({ data: { id: warehouse.id, name } }), {
      success: 'Nombre del almacén actualizado.',
      onSuccess: () => setOpen(false),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          aria-label={`Cambiar nombre de ${warehouse.name}`}
          className="h-auto min-h-[44px] gap-[7px] px-2 text-sm font-[650] text-ink-link hover:underline"
        >
          <PencilIcon size={15} aria-hidden />
          Cambiar nombre
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100vw-24px)] rounded-2xl bg-white p-[23px] md:max-w-[430px] md:p-[29px]">
        <DialogHeader>
          <DialogTitle>Cambiar nombre</DialogTitle>
          <DialogDescription>
            Escribe el nuevo nombre de {warehouse.name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`warehouse-name-${warehouse.id}`}>Nombre</Label>
            <Input
              id={`warehouse-name-${warehouse.id}`}
              name="name"
              defaultValue={warehouse.name}
              autoComplete="off"
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
            {run.pending ? 'Guardando…' : 'Guardar nombre'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

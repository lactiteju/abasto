import { useState } from 'react'
import type { FormEvent } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { useActionRunner } from '#/hooks/use-action-runner'
import { useBusiness } from '#/modules/business/hooks/use-business'
import { updateBusinessFn } from '#/modules/business/server/business'

/** «Negocio» card in Configuración: the name and location shown app-wide. */
export function BusinessSection() {
  const business = useBusiness()
  const run = useActionRunner()
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '')
    const location = String(form.get('location') ?? '')
    // Same rules as the server, so a blank field is explained without a request.
    if (!name.trim()) return setError('Escribe el nombre del negocio.')
    if (!location.trim()) return setError('Escribe la ubicación.')
    setError(null)
    await run(() => updateBusinessFn({ data: { name, location } }), {
      success: 'Datos del negocio guardados.',
    })
  }

  return (
    <section aria-labelledby="business-heading" className="mb-8">
      <h2 id="business-heading" className="mb-3 text-xl font-[650]">
        Negocio
      </h2>
      <form
        // Remount when the saved value changes so the fields show it.
        key={`${business.name}|${business.location}`}
        onSubmit={(event) => void submit(event)}
        className="grid max-w-[640px] gap-4 rounded-xl border border-[#f0eae3] bg-white p-5"
      >
        <p className="text-sm text-[#947f86]">
          Aparece en el menú, las notas, los reportes y la tienda.
        </p>
        <div className="grid gap-2">
          <Label htmlFor="business-name">Nombre</Label>
          <Input
            id="business-name"
            name="name"
            autoComplete="off"
            maxLength={80}
            defaultValue={business.name}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="business-location">Ubicación</Label>
          <Input
            id="business-location"
            name="location"
            autoComplete="off"
            maxLength={120}
            defaultValue={business.location}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="ghost"
          disabled={run.pending}
          className="h-auto min-h-[44px] w-fit rounded-[9px] bg-primary px-[17px] py-2.5 text-sm font-[650] text-brand-ink hover:bg-brand-hover disabled:opacity-45"
        >
          {run.pending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </section>
  )
}

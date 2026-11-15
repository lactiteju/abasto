import { asc, eq } from 'drizzle-orm'
import { db } from '#/db'
import { isUniqueViolation } from '#/db/errors'
import { AppError } from '#/lib/errors'
import { authorize } from '#/modules/access/lib/policy'
import type { Actor } from '#/modules/access/lib/policy'
import { suppliers } from '#/modules/catalog/db/schema'
import {
  defaultFolioPrefix,
  invalidFolioPrefix,
  normalizeFolioPrefix,
} from '#/modules/catalog/lib/folio-prefix'

export type Supplier = typeof suppliers.$inferSelect
export type SupplierInput = {
  name: string
  contact?: string
  phone?: string
  notes?: string
  /** 1–3 letters A–Z; omitted on create, the initial of the name is used. */
  folioPrefix?: string
}
export type SupplierPatch = Partial<SupplierInput> & { active?: boolean }

const duplicate = (error: unknown) =>
  new AppError(
    'conflict',
    constraintOf(error) === 'suppliers_folio_prefix_unique'
      ? 'Ya hay un proveedor con esa clave de folio.'
      : 'Ya existe un proveedor con ese nombre.',
  )

/** Name of the constraint a Postgres error (or its cause) violated. */
function constraintOf(error: unknown): string | undefined {
  let current: unknown = error
  for (let depth = 0; current && depth < 3; depth++) {
    const name = (current as { constraint?: unknown }).constraint
    if (typeof name === 'string') return name
    current = (current as { cause?: unknown }).cause
  }
  return undefined
}

function cleaned(input: SupplierPatch): SupplierPatch {
  const values: SupplierPatch = {}
  if (input.name !== undefined) {
    values.name = input.name.trim()
    if (!values.name) {
      throw new AppError('invalid', 'Escribe el nombre del proveedor.')
    }
  }
  if (input.folioPrefix !== undefined) {
    const prefix = normalizeFolioPrefix(input.folioPrefix)
    if (!prefix) throw new AppError('invalid', invalidFolioPrefix)
    values.folioPrefix = prefix
  }
  if (input.contact !== undefined) values.contact = input.contact.trim()
  if (input.phone !== undefined) values.phone = input.phone.trim()
  if (input.notes !== undefined) values.notes = input.notes.trim()
  if (input.active !== undefined) values.active = input.active
  return values
}

export async function createSupplier(
  actor: Actor,
  input: SupplierInput,
): Promise<Supplier> {
  authorize(actor, 'catalog.manage')
  const values = cleaned(input) as SupplierInput
  // Two creations can pick the same default; the unique index rejects the
  // second one, which then picks again against the refreshed keys.
  for (let attempt = 0; ; attempt++) {
    try {
      const folioPrefix =
        values.folioPrefix ??
        defaultFolioPrefix(
          values.name,
          (
            await db.select({ prefix: suppliers.folioPrefix }).from(suppliers)
          ).map((row) => row.prefix),
        )
      const [created] = await db
        .insert(suppliers)
        .values({ ...values, folioPrefix })
        .returning()
      return created
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      const retry =
        input.folioPrefix === undefined &&
        constraintOf(error) === 'suppliers_folio_prefix_unique' &&
        attempt < 5
      if (!retry) throw duplicate(error)
    }
  }
}

export async function updateSupplier(
  actor: Actor,
  id: string,
  patch: SupplierPatch,
): Promise<Supplier> {
  authorize(actor, 'catalog.manage')
  const values = cleaned(patch)
  try {
    const query = Object.keys(values).length
      ? db.update(suppliers).set(values).where(eq(suppliers.id, id)).returning()
      : db.select().from(suppliers).where(eq(suppliers.id, id))
    const current = (await query).at(0)
    if (!current) {
      throw new AppError('not_found', 'No encontramos ese proveedor.')
    }
    return current
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicate(error)
    throw error
  }
}

/** Any signed-in actor may read suppliers. */
export async function listSuppliers(_actor: Actor): Promise<Array<Supplier>> {
  return db.select().from(suppliers).orderBy(asc(suppliers.name))
}

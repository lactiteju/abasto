import { asc, eq } from 'drizzle-orm'
import { db } from '#/db'
import { isUniqueViolation } from '#/db/errors'
import { AppError } from '#/lib/errors'
import { warehouseAssignments } from '#/modules/access/db/schema'
import { authorize } from '#/modules/access/lib/policy'
import type { Actor } from '#/modules/access/lib/policy'
import { warehouses } from '#/modules/warehouses/db/schema'

export type Warehouse = { id: string; name: string }

const maxNameLength = 80

const columns = { id: warehouses.id, name: warehouses.name }

/** Trimmed name, or the Spanish refusal for a blank or too long one. */
function validName(raw: string) {
  const name = raw.trim()
  if (!name) throw new AppError('invalid', 'Escribe el nombre del almacén.')
  if (name.length > maxNameLength) {
    throw new AppError(
      'invalid',
      `El nombre del almacén no puede tener más de ${maxNameLength} caracteres.`,
    )
  }
  return name
}

const duplicateName = () =>
  new AppError('conflict', 'Ya existe un almacén con ese nombre.')

export async function createWarehouse(
  actor: Actor,
  input: { name: string },
): Promise<Warehouse> {
  authorize(actor, 'warehouses.manage')
  const name = validName(input.name)
  try {
    const [created] = await db
      .insert(warehouses)
      .values({ name })
      .returning(columns)
    return created
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateName()
    throw error
  }
}

export async function renameWarehouse(
  actor: Actor,
  input: { id: string; name: string },
): Promise<Warehouse> {
  authorize(actor, 'warehouses.manage')
  const name = validName(input.name)
  try {
    const renamed = (
      await db
        .update(warehouses)
        .set({ name })
        .where(eq(warehouses.id, input.id))
        .returning(columns)
    ).at(0)
    if (!renamed) {
      throw new AppError('not_found', 'No encontramos ese almacén.')
    }
    return renamed
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateName()
    throw error
  }
}

/** Warehouses the actor may see: all for the owner, assigned ones for staff. */
export async function listWarehouses(actor: Actor): Promise<Array<Warehouse>> {
  if (actor.role === 'owner') {
    return db.select(columns).from(warehouses).orderBy(asc(warehouses.name))
  }
  return db
    .select(columns)
    .from(warehouses)
    .innerJoin(
      warehouseAssignments,
      eq(warehouseAssignments.warehouseId, warehouses.id),
    )
    .where(eq(warehouseAssignments.userId, actor.userId))
    .orderBy(asc(warehouses.name))
}

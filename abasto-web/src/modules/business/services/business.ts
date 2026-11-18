import { db } from '#/db'
import { workspace } from '#/config/workspace'
import type { Business } from '#/config/workspace'
import { AppError } from '#/lib/errors'
import { authorize } from '#/modules/access/lib/policy'
import type { Actor } from '#/modules/access/lib/policy'
import { businessSettings } from '#/modules/business/db/schema'

export const maxBusinessNameLength = 80
export const maxBusinessLocationLength = 120

/** The persisted business identity; the config defaults while nothing is saved. */
export async function getBusiness(): Promise<Business> {
  const rows = await db
    .select({
      name: businessSettings.name,
      location: businessSettings.location,
    })
    .from(businessSettings)
    .limit(1)
  return rows.at(0) ?? { ...workspace.business }
}

export async function updateBusiness(
  actor: Actor,
  input: Business,
): Promise<Business> {
  authorize(actor, 'business.manage')
  const name = input.name.trim()
  const location = input.location.trim()
  if (!name) throw new AppError('invalid', 'Escribe el nombre del negocio.')
  if (name.length > maxBusinessNameLength) {
    throw new AppError(
      'invalid',
      `El nombre del negocio no puede tener más de ${maxBusinessNameLength} caracteres.`,
    )
  }
  if (!location) throw new AppError('invalid', 'Escribe la ubicación.')
  if (location.length > maxBusinessLocationLength) {
    throw new AppError(
      'invalid',
      `La ubicación no puede tener más de ${maxBusinessLocationLength} caracteres.`,
    )
  }
  const [saved] = await db
    .insert(businessSettings)
    .values({ id: 1, name, location })
    .onConflictDoUpdate({
      target: businessSettings.id,
      set: { name, location, updatedAt: new Date() },
    })
    .returning({
      name: businessSettings.name,
      location: businessSettings.location,
    })
  return saved
}

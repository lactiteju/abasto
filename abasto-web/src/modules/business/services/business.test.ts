import { beforeEach, describe, expect, test } from 'bun:test'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import { AppError } from '#/lib/errors'
import { signIn } from '#/modules/access/lib/testing'
import {
  bootstrapOwner,
  createStaffUser,
  requireActor,
} from '#/modules/access/services/access'
import {
  getBusiness,
  maxBusinessLocationLength,
  maxBusinessNameLength,
  updateBusiness,
} from '#/modules/business/services/business'

async function setup() {
  await bootstrapOwner({
    name: 'Dueño',
    email: 'dueno@abasto.test',
    password: 'secreto-123',
  })
  const owner = await requireActor(
    await signIn('dueno@abasto.test', 'secreto-123'),
  )
  await createStaffUser(owner, {
    name: 'Cajero',
    email: 'cajero@abasto.test',
    password: 'secreto-456',
  })
  const staff = await requireActor(
    await signIn('cajero@abasto.test', 'secreto-456'),
  )
  return { owner, staff }
}

async function errorOf(run: () => Promise<unknown>) {
  try {
    await run()
  } catch (error) {
    return error
  }
  return undefined
}

const defaults = {
  name: 'Distribuidora de Lácteos',
  location: 'Tejupilco, Estado de México',
}

describe('business settings', () => {
  beforeEach(async () => {
    await resetDatabase(db)
  })

  test('reads the defaults while nothing is saved', async () => {
    expect(await getBusiness()).toEqual(defaults)
  })

  test('the owner saves trimmed values that every reader sees', async () => {
    const { owner } = await setup()
    const saved = await updateBusiness(owner, {
      name: '  Lácteos del Valle ',
      location: ' Arcelia, Guerrero ',
    })
    const expected = {
      name: 'Lácteos del Valle',
      location: 'Arcelia, Guerrero',
    }
    expect(saved).toEqual(expected)
    expect(await getBusiness()).toEqual(expected)
    await updateBusiness(owner, { name: 'Otro nombre', location: 'Otro lugar' })
    expect(await getBusiness()).toEqual({
      name: 'Otro nombre',
      location: 'Otro lugar',
    })
  })

  test('staff cannot change it', async () => {
    const { staff } = await setup()
    const error = await errorOf(() =>
      updateBusiness(staff, { name: 'Intruso', location: 'X' }),
    )
    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).code).toBe('forbidden')
    expect(await getBusiness()).toEqual(defaults)
  })

  test('rejects blank and oversized values', async () => {
    const { owner } = await setup()
    const invalid = async (name: string, location: string) => {
      const error = await errorOf(() =>
        updateBusiness(owner, { name, location }),
      )
      expect(error).toBeInstanceOf(AppError)
      expect((error as AppError).code).toBe('invalid')
    }
    await invalid('   ', 'Tejupilco')
    await invalid('Negocio', '  ')
    await invalid('x'.repeat(maxBusinessNameLength + 1), 'Tejupilco')
    await invalid('Negocio', 'x'.repeat(maxBusinessLocationLength + 1))
    expect(await getBusiness()).toEqual(defaults)
  })
})

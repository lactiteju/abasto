import { beforeEach, describe, expect, test } from 'bun:test'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import { AppError } from '#/lib/errors'
import {
  createSupplier,
  listSuppliers,
  updateSupplier,
} from '#/modules/catalog/services/suppliers'
import {
  counts,
  errorOf,
  setupActors,
} from '#/modules/catalog/services/testing'

beforeEach(() => resetDatabase(db))

const forbidden = 'No tienes permiso para esta acción.'

describe('createSupplier', () => {
  test('the owner creates a supplier with a trimmed name; staff can read it', async () => {
    const { owner, staff } = await setupActors()
    const created = await createSupplier(owner, {
      name: '  Alpura ',
      phone: '555',
    })
    expect(created.name).toBe('Alpura')
    expect(created.phone).toBe('555')
    expect(created.active).toBe(true)
    expect(await listSuppliers(staff)).toEqual([created])
  })

  test('rejects a duplicate name regardless of case and spaces', async () => {
    const { owner } = await setupActors()
    await createSupplier(owner, { name: 'Alpura' })
    const error = await errorOf(() =>
      createSupplier(owner, { name: ' ALPURA' }),
    )
    expect(error).toBeInstanceOf(AppError)
    expect(error.code).toBe('conflict')
    expect(error.message).toBe('Ya existe un proveedor con ese nombre.')
    expect((await counts()).suppliers).toBe(1)
  })

  test('rejects an empty name', async () => {
    const { owner } = await setupActors()
    const error = await errorOf(() => createSupplier(owner, { name: '  ' }))
    expect(error.code).toBe('invalid')
    expect(error.message).toBe('Escribe el nombre del proveedor.')
    expect((await counts()).suppliers).toBe(0)
  })

  test('staff cannot create suppliers', async () => {
    const { staff } = await setupActors()
    const error = await errorOf(() => createSupplier(staff, { name: 'Lala' }))
    expect(error.code).toBe('forbidden')
    expect(error.message).toBe(forbidden)
    expect((await counts()).suppliers).toBe(0)
  })
})

describe('updateSupplier', () => {
  test('updates fields and can deactivate', async () => {
    const { owner } = await setupActors()
    const supplier = await createSupplier(owner, { name: 'Lala' })
    const updated = await updateSupplier(owner, supplier.id, {
      name: 'Lala Norte',
      contact: 'Ana',
      active: false,
    })
    expect(updated).toMatchObject({
      name: 'Lala Norte',
      contact: 'Ana',
      active: false,
    })
    expect(await listSuppliers(owner)).toEqual([updated])
  })

  test('keeping its own name in another case is allowed', async () => {
    const { owner } = await setupActors()
    const supplier = await createSupplier(owner, { name: 'Lala' })
    const updated = await updateSupplier(owner, supplier.id, { name: 'LALA' })
    expect(updated.name).toBe('LALA')
  })

  test('rejects a name used by another supplier and leaves rows unchanged', async () => {
    const { owner } = await setupActors()
    await createSupplier(owner, { name: 'Alpura' })
    const lala = await createSupplier(owner, { name: 'Lala' })
    const before = await listSuppliers(owner)
    const error = await errorOf(() =>
      updateSupplier(owner, lala.id, { name: 'alpura' }),
    )
    expect(error.code).toBe('conflict')
    expect(error.message).toBe('Ya existe un proveedor con ese nombre.')
    expect(await listSuppliers(owner)).toEqual(before)
  })

  test('rejects an empty name and an unknown supplier', async () => {
    const { owner } = await setupActors()
    const lala = await createSupplier(owner, { name: 'Lala' })
    const empty = await errorOf(() =>
      updateSupplier(owner, lala.id, { name: ' ' }),
    )
    expect(empty.code).toBe('invalid')
    expect(empty.message).toBe('Escribe el nombre del proveedor.')
    const missing = await errorOf(() =>
      updateSupplier(owner, crypto.randomUUID(), { notes: 'x' }),
    )
    expect(missing.code).toBe('not_found')
    expect(missing.message).toBe('No encontramos ese proveedor.')
    expect((await listSuppliers(owner))[0]?.name).toBe('Lala')
  })

  test('staff cannot update suppliers', async () => {
    const { owner, staff } = await setupActors()
    const lala = await createSupplier(owner, { name: 'Lala' })
    const error = await errorOf(() =>
      updateSupplier(staff, lala.id, { name: 'Otro' }),
    )
    expect(error.code).toBe('forbidden')
    expect(error.message).toBe(forbidden)
    expect((await listSuppliers(owner))[0]?.name).toBe('Lala')
  })
})

describe('supplier folio prefix', () => {
  test('defaults to the initial of the name', async () => {
    const { owner } = await setupActors()
    const alpura = await createSupplier(owner, { name: 'Alpura' })
    expect(alpura.folioPrefix).toBe('A')
  })

  test('another supplier with the same initial gets a different key', async () => {
    const { owner } = await setupActors()
    await createSupplier(owner, { name: 'Alpura' })
    const second = await createSupplier(owner, { name: 'Abarrotes del Sur' })
    const third = await createSupplier(owner, { name: 'Acme' })
    expect(second.folioPrefix).toBe('AB')
    expect(third.folioPrefix).toBe('AC')
  })

  test('an explicit key is normalized to uppercase', async () => {
    const { owner } = await setupActors()
    const lala = await createSupplier(owner, {
      name: 'LALA',
      folioPrefix: ' l ',
    })
    expect(lala.folioPrefix).toBe('L')
  })

  test('rejects an invalid key and stores nothing', async () => {
    const { owner } = await setupActors()
    const error = await errorOf(() =>
      createSupplier(owner, { name: 'Alpura', folioPrefix: 'A1' }),
    )
    expect(error.code).toBe('invalid')
    expect(error.message).toBe(
      'La clave de folio son de 1 a 3 letras de la A a la Z.',
    )
    expect((await counts()).suppliers).toBe(0)
  })

  test('rejects a duplicate key regardless of case and keeps the data', async () => {
    const { owner } = await setupActors()
    await createSupplier(owner, { name: 'Alpura' })
    const error = await errorOf(() =>
      createSupplier(owner, { name: 'Otro', folioPrefix: 'a' }),
    )
    expect(error.code).toBe('conflict')
    expect(error.message).toBe('Ya hay un proveedor con esa clave de folio.')
    expect((await counts()).suppliers).toBe(1)
  })

  test('a name conflict still reports the name', async () => {
    const { owner } = await setupActors()
    await createSupplier(owner, { name: 'Alpura' })
    const error = await errorOf(() =>
      createSupplier(owner, { name: 'alpura', folioPrefix: 'Z' }),
    )
    expect(error.message).toBe('Ya existe un proveedor con ese nombre.')
  })

  test('the key can be edited; a duplicate or invalid edit changes nothing', async () => {
    const { owner } = await setupActors()
    const alpura = await createSupplier(owner, { name: 'Alpura' })
    const lala = await createSupplier(owner, { name: 'LALA' })
    const updated = await updateSupplier(owner, alpura.id, {
      folioPrefix: 'alp',
    })
    expect(updated.folioPrefix).toBe('ALP')
    const clash = await errorOf(() =>
      updateSupplier(owner, alpura.id, { folioPrefix: 'l' }),
    )
    expect(clash.message).toBe('Ya hay un proveedor con esa clave de folio.')
    const bad = await errorOf(() =>
      updateSupplier(owner, alpura.id, { folioPrefix: '' }),
    )
    expect(bad.code).toBe('invalid')
    const stored = await listSuppliers(owner)
    expect(stored.map((s) => [s.name, s.folioPrefix])).toEqual([
      ['Alpura', 'ALP'],
      ['LALA', lala.folioPrefix],
    ])
  })

  test('renaming a supplier keeps its key', async () => {
    const { owner } = await setupActors()
    const lala = await createSupplier(owner, { name: 'Grupo Lala' })
    const renamed = await updateSupplier(owner, lala.id, { name: 'LALA' })
    expect(renamed.name).toBe('LALA')
    expect(renamed.folioPrefix).toBe(lala.folioPrefix)
  })
})

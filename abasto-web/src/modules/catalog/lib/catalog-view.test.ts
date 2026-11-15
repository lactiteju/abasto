import { describe, expect, test } from 'bun:test'
import {
  catalogViewOf,
  defaultCatalogView,
  inventoryNote,
} from '#/modules/catalog/lib/catalog-view'

describe('catalogViewOf', () => {
  test('keeps a stored valid choice', () => {
    expect(catalogViewOf('cards')).toBe('cards')
    expect(catalogViewOf('table')).toBe('table')
  })

  test('falls back to the cards for missing or unknown values', () => {
    expect(defaultCatalogView).toBe('cards')
    expect(catalogViewOf(null)).toBe('cards')
    expect(catalogViewOf('grid')).toBe('cards')
  })
})

describe('inventoryNote', () => {
  test('names the unit when every product shares it', () => {
    expect(inventoryNote([{ unit: 'piezas' }, { unit: 'piezas' }])).toBe(
      'El inventario se lleva en piezas.',
    )
  })

  test('stays generic when units differ or there are no products', () => {
    expect(inventoryNote([{ unit: 'piezas' }, { unit: 'cajas' }])).toBe(
      'El inventario se lleva en la unidad base de cada producto.',
    )
    expect(inventoryNote([])).toBe(
      'El inventario se lleva en la unidad base de cada producto.',
    )
  })
})

import { describe, expect, test } from 'bun:test'

import {
  editedLossReference,
  isEditableLossReference,
  lossEditDraft,
  lossRootId,
  voidedLossReference,
} from '#/modules/inventory/lib/loss-edits'

describe('loss edits', () => {
  test('an edit points at the first registration', () => {
    expect(lossRootId({ id: 'a', reference: null })).toBe('a')
    expect(lossRootId({ id: 'b', reference: editedLossReference('a') })).toBe(
      'a',
    )
    expect(voidedLossReference('a')).toBe('void:a')
  })

  test('only owner mermas are editable', () => {
    expect(isEditableLossReference(null)).toBe(true)
    expect(isEditableLossReference('edit:a')).toBe(true)
    expect(isEditableLossReference('3f2a9c1e-aaaa')).toBe(false)
  })

  test('the draft starts from the current motive', () => {
    expect(lossEditDraft('dañado: Se cayó')).toEqual({
      category: 'dañado',
      note: 'Se cayó',
    })
    expect(lossEditDraft('caducado')).toEqual({
      category: 'caducado',
      note: '',
    })
    expect(lossEditDraft('otro: Robo')).toEqual({
      category: 'otro',
      note: 'Robo',
    })
    expect(lossEditDraft('otro')).toEqual({ category: 'otro', note: '' })
  })
})

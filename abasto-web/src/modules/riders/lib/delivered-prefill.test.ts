import { describe, expect, it } from 'bun:test'

import { deliveredText } from '#/modules/riders/lib/delivered-prefill'

describe('deliveredText', () => {
  it('prefills with the expected amount while untouched', () => {
    expect(deliveredText(null, 43850)).toBe('438.50')
  })

  it('follows the expected amount as it changes', () => {
    expect(deliveredText(null, 43850)).toBe('438.50')
    expect(deliveredText(null, 20000)).toBe('200.00')
  })

  it('keeps what the user typed', () => {
    expect(deliveredText('300', 20000)).toBe('300')
  })

  it('keeps an emptied field instead of refilling it', () => {
    expect(deliveredText('', 20000)).toBe('')
  })
})

import { describe, expect, test } from 'bun:test'

import { keepOpenOnOutside } from '#/components/ui/dialog'

// Dialog and Sheet both wire this into Radix onPointerDownOutside /
// onInteractOutside; preventDefault there is what stops the dismissal.
describe('keepOpenOnOutside', () => {
  test('prevents default so an outside click does not close', () => {
    const event = new Event('pointerdown', { cancelable: true })
    keepOpenOnOutside()(event)
    expect(event.defaultPrevented).toBe(true)
  })

  test('runs the caller handler and still prevents default', () => {
    const event = new Event('pointerdown', { cancelable: true })
    let called = false
    keepOpenOnOutside(() => {
      called = true
    })(event)
    expect(called).toBe(true)
    expect(event.defaultPrevented).toBe(true)
  })
})

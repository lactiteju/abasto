import { describe, expect, test } from 'bun:test'

import { join } from 'node:path'

import {
  keepOpenOnOutside,
  keepOpenOnOutsideProps,
} from '#/components/ui/dialog'

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

describe('keepOpenOnOutsideProps', () => {
  test('both outside handlers prevent the dismissal', () => {
    for (const handler of [
      keepOpenOnOutsideProps.onPointerDownOutside,
      keepOpenOnOutsideProps.onInteractOutside,
    ]) {
      const event = new Event('pointerdown', { cancelable: true })
      handler(event)
      expect(event.defaultPrevented).toBe(true)
    }
  })
})

// A hand-drawn Radix dialog bypasses DialogContent: it must opt back in.
describe('hand-drawn dialogs', () => {
  test('every raw Dialog.Content outside ui/ spreads keepOpenOnOutsideProps', async () => {
    const offenders: Array<string> = []
    const root = join(import.meta.dir, '../..')
    for await (const file of new Bun.Glob('**/*.tsx').scan(root)) {
      if (file.startsWith('components/ui/') || file.endsWith('.test.tsx')) {
        continue
      }
      const source = await Bun.file(join(root, file)).text()
      if (
        /DialogPrimitive\.Content/.test(source) &&
        !source.includes('keepOpenOnOutsideProps')
      ) {
        offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })
})

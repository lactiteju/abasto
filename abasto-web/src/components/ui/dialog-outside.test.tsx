import { describe, expect, test } from 'bun:test'

import { join } from 'node:path'

import type { ReactElement } from 'react'

import { Dialog } from '#/components/ui/dialog'
import { Sheet, SheetContent } from '#/components/ui/sheet'

type RootProps = {
  closeOnOutsidePress?: boolean
  side?: string
  onOpenChange: (open: boolean, details: unknown) => void
}

// The wrappers return the ui-sdk root, so its props are what the browser acts on.
const rootProps = (element: ReactElement) => element.props as RootProps

describe('Dialog', () => {
  test('ignores outside presses by default', () => {
    expect(rootProps(Dialog({})).closeOnOutsidePress).toBe(false)
  })

  test('lets a caller opt back in', () => {
    expect(
      rootProps(Dialog({ closeOnOutsidePress: true })).closeOnOutsidePress,
    ).toBe(true)
  })

  test('Esc over an open picker list keeps the dialog open', () => {
    const opened: Array<boolean> = []
    const props = rootProps(
      Dialog({ onOpenChange: (open) => opened.push(open) }),
    )
    let canceled = false
    const list = {
      closest: (selector: string) => selector.includes('combobox'),
    }
    props.onOpenChange(false, {
      reason: 'escape-key',
      event: { target: list },
      cancel: () => {
        canceled = true
      },
    })
    expect(canceled).toBe(true)
    expect(opened).toEqual([])
  })

  test('Esc elsewhere still closes', () => {
    const opened: Array<boolean> = []
    const props = rootProps(
      Dialog({ onOpenChange: (open) => opened.push(open) }),
    )
    props.onOpenChange(false, {
      reason: 'escape-key',
      event: { target: { closest: () => null } },
      cancel: () => {},
    })
    expect(opened).toEqual([false])
  })
})

describe('Sheet', () => {
  const sheetOf = (content: ReactElement) =>
    rootProps(Sheet({ children: content }) as ReactElement)

  test('ignores outside presses and opens from the right by default', () => {
    const props = sheetOf(<SheetContent />)
    expect(props.closeOnOutsidePress).toBe(false)
    expect(props.side).toBe('right')
  })

  test('dismissOnOutside and side on SheetContent reach the drawer root', () => {
    const props = sheetOf(<SheetContent side="left" dismissOnOutside />)
    expect(props.closeOnOutsidePress).toBe(true)
    expect(props.side).toBe('left')
  })
})

// A hand-drawn dialog outside ui/ would bypass the wrappers' outside-press rule.
describe('dialog primitives', () => {
  test('only ui/ and the wrappers import dialog primitives', async () => {
    const offenders: Array<string> = []
    const root = join(import.meta.dir, '../..')
    for await (const file of new Bun.Glob('**/*.tsx').scan(root)) {
      if (file.startsWith('components/ui/') || file.endsWith('.test.tsx')) {
        continue
      }
      const source = await Bun.file(join(root, file)).text()
      if (
        /@ui-sdk\/react\/(dialog|alert-dialog|drawer)'/.test(source) ||
        /\b(Dialog|AlertDialog)\b[^\n]*from 'radix-ui'/.test(source) ||
        /import[^;]*\b(Dialog|AlertDialog) as \w+[^;]*from 'radix-ui'/.test(
          source,
        )
      ) {
        offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })
})

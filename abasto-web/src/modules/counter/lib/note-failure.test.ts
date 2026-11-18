import { describe, expect, test } from 'bun:test'

import { ClientError, genericErrorMessage } from '#/lib/boundary'
import {
  noteFailureMessage,
  staleBuildMessage,
} from '#/modules/counter/lib/note-failure'

describe('noteFailureMessage', () => {
  test('keeps the server message', () => {
    expect(
      noteFailureMessage(
        new ClientError('not_found', 'No encontramos ese pedido.'),
      ),
    ).toBe('No encontramos ese pedido.')
  })

  test('a lazy chunk that cannot load asks for a reload', () => {
    for (const message of [
      'Failed to fetch dynamically imported module: https://x/assets/a.js',
      'error loading dynamically imported module',
      'Importing a module script failed.',
    ]) {
      expect(noteFailureMessage(new TypeError(message))).toBe(staleBuildMessage)
    }
  })

  test('anything else stays generic', () => {
    expect(noteFailureMessage(new TypeError("Cannot read 'replace'"))).toBe(
      genericErrorMessage,
    )
    expect(noteFailureMessage('boom')).toBe(genericErrorMessage)
  })
})

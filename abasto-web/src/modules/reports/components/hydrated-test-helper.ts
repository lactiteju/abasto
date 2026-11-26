import { mock } from 'bun:test'

import * as hydration from '#/hooks/use-hydrated'

const actual = { ...hydration }

/**
 * Server HTML disables every ui/button until the client hydrates. Runs `render`
 * as if hydrated, so a test can tell a button the page disabled from one
 * waiting for hydration, then puts the real hook back.
 */
export async function whileHydrated<T>(render: () => Promise<T> | T) {
  mock.module('#/hooks/use-hydrated', () => ({ useHydrated: () => true }))
  try {
    return await render()
  } finally {
    mock.module('#/hooks/use-hydrated', () => actual)
  }
}

import { describe, expect, test } from 'bun:test'

import { runInTimingScope } from '#/lib/server-timing/store'
import { instrumentPgQueries } from './timing.ts'

class FakeClient {
  query(_text: string, cb?: (err: null, res: number) => void) {
    if (typeof cb === 'function') {
      setTimeout(() => cb(null, 1), 2)
      return undefined
    }
    return new Promise((resolve) => setTimeout(() => resolve(1), 2))
  }
}

describe('instrumentPgQueries', () => {
  test('counts promise and callback queries inside a scope, once when re-applied', async () => {
    instrumentPgQueries(FakeClient)
    instrumentPgQueries(FakeClient)
    const client = new FakeClient()
    const { scope } = await runInTimingScope(async () => {
      await client.query('select 1')
      await new Promise((r) => client.query('select 2', r))
    })
    expect(scope.queries).toBe(2)
    expect(scope.dbMs).toBeGreaterThan(0)
  })

  test('queries outside a scope are ignored and results pass through', async () => {
    instrumentPgQueries(FakeClient)
    expect(await new FakeClient().query('select 1')).toBe(1)
  })
})

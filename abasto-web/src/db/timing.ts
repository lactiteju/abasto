import pg from 'pg'

import { recordQuery } from '#/lib/server-timing/store'

const PATCHED = Symbol.for('abasto.pg.timing')

/**
 * Times every query run through `pg.Client` (pool queries and transactions
 * included) and reports it to the active server-function timing scope.
 * Idempotent; zero overhead outside a scope beyond one `performance.now()`.
 */
export function instrumentPgQueries(client: { prototype: any } = pg.Client) {
  const proto = client.prototype
  if (proto[PATCHED]) return
  const original = proto.query
  proto.query = function timedQuery(this: unknown, ...args: Array<any>) {
    const start = performance.now()
    const done = () => recordQuery(performance.now() - start)
    const last = args.length - 1
    if (typeof args[last] === 'function') {
      const callback = args[last]
      args[last] = (...cbArgs: Array<unknown>) => {
        done()
        return callback(...cbArgs)
      }
      return original.apply(this, args)
    }
    const result = original.apply(this, args)
    if (
      typeof args[0]?.submit !== 'function' &&
      typeof result?.then === 'function'
    ) {
      result.then(done, done)
    }
    return result
  }
  proto[PATCHED] = true
}

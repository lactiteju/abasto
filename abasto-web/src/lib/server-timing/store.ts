import { AsyncLocalStorage } from 'node:async_hooks'

/** Mutable counters for one server-function call. */
export interface TimingScope {
  dbMs: number
  queries: number
}

const storage = new AsyncLocalStorage<TimingScope>()

/**
 * Runs `run` inside a fresh scope. When it settles, the scope's DB totals are
 * added to the enclosing scope (a server function calling another one).
 */
export async function runInTimingScope<T>(
  run: (scope: TimingScope) => Promise<T>,
): Promise<{ result: T; scope: TimingScope }> {
  const parent = storage.getStore()
  const scope: TimingScope = { dbMs: 0, queries: 0 }
  try {
    const result = await storage.run(scope, () => run(scope))
    return { result, scope }
  } finally {
    if (parent) {
      parent.dbMs += scope.dbMs
      parent.queries += scope.queries
    }
  }
}

/** Called by the pg instrumentation for every finished query. */
export function recordQuery(ms: number, scope = storage.getStore()) {
  if (!scope) return
  scope.dbMs += ms
  scope.queries += 1
}

export function currentTimingScope() {
  return storage.getStore()
}

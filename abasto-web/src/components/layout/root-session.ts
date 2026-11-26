const TTL_MS = 30_000

let cached: { at: number; value: unknown } | undefined

/**
 * Root `beforeLoad` runs on every navigation and, uncached, would block each
 * one on server round trips before any pending UI can show. In the browser the
 * result is reused for 30s; `router.invalidate()` (login, logout, mutations)
 * clears it. On the server every request loads fresh.
 */
export async function loadRootSession<T>(load: () => Promise<T>): Promise<T> {
  if (typeof document === 'undefined') return load()
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value as T
  const value = await load()
  cached = { at: Date.now(), value }
  return value
}

export function clearRootSession() {
  cached = undefined
}

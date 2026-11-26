import { formatLogLine, formatServerTiming, shouldLog } from './format.ts'
import { runInTimingScope } from './store.ts'

interface MeasureOptions {
  name: string
  /** Receives the `Server-Timing` value; failures here never affect the call. */
  setHeader: (value: string) => void
  log?: (line: string) => void
  now?: () => number
}

/** Runs one server-function call, measuring total time, DB time and queries. */
export async function measureServerFn<T>(
  {
    name,
    setHeader,
    log = console.log,
    now = performance.now.bind(performance),
  }: MeasureOptions,
  run: () => Promise<T>,
): Promise<T> {
  const start = now()
  let scope = { dbMs: 0, queries: 0 }
  try {
    const out = await runInTimingScope(async (s) => {
      scope = s
      return run()
    })
    return out.result
  } finally {
    const sample = { fn: name, ms: now() - start, ...scope }
    try {
      setHeader(formatServerTiming(sample))
      if (shouldLog(sample)) log(formatLogLine(sample))
    } catch {
      // Observability must never break a call.
    }
  }
}

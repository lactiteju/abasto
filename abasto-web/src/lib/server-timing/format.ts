export interface TimingSample {
  fn: string
  ms: number
  dbMs: number
  queries: number
}

const round = (value: number) => Math.round(value * 10) / 10

/** `fn;dur=12.3, db;dur=4.5;desc="3 queries"` (W3C Server-Timing). */
export function formatServerTiming({ ms, dbMs, queries }: TimingSample) {
  const noun = queries === 1 ? 'query' : 'queries'
  return `fn;dur=${round(ms)}, db;dur=${round(dbMs)};desc="${queries} ${noun}"`
}

/** Slow threshold in ms from `SLOW_FN_MS` (default 300). */
export function slowThresholdMs(raw = process.env.SLOW_FN_MS) {
  const value = Number(raw)
  return raw !== undefined && raw !== '' && Number.isFinite(value) && value >= 0
    ? value
    : 300
}

export function shouldLog(
  sample: TimingSample,
  env: Record<string, string | undefined> = process.env,
) {
  return env.TIMING_LOG === '1' || sample.ms >= slowThresholdMs(env.SLOW_FN_MS)
}

/** One structured (JSON) log line. */
export function formatLogLine(sample: TimingSample) {
  return JSON.stringify({
    event: 'server-fn',
    fn: sample.fn,
    ms: round(sample.ms),
    dbMs: round(sample.dbMs),
    queries: sample.queries,
  })
}

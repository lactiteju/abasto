import { describe, expect, test } from 'bun:test'

import {
  formatLogLine,
  formatServerTiming,
  shouldLog,
  slowThresholdMs,
} from './format.ts'
import { measureServerFn } from './measure.ts'
import { recordQuery } from './store.ts'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function fakeClock(...ticks: Array<number>) {
  let i = 0
  return () => ticks[Math.min(i++, ticks.length - 1)]
}

describe('formatServerTiming', () => {
  test('renders fn and db metrics with the query count', () => {
    expect(
      formatServerTiming({ fn: 'x', ms: 12.345, dbMs: 4.5, queries: 3 }),
    ).toBe('fn;dur=12.3, db;dur=4.5;desc="3 queries"')
    expect(formatServerTiming({ fn: 'x', ms: 1, dbMs: 0, queries: 1 })).toBe(
      'fn;dur=1, db;dur=0;desc="1 query"',
    )
  })
})

describe('log policy', () => {
  const sample = { fn: 'x', ms: 400, dbMs: 1, queries: 1 }
  test('threshold defaults to 300 and honors SLOW_FN_MS', () => {
    expect(slowThresholdMs(undefined)).toBe(300)
    expect(slowThresholdMs('abc')).toBe(300)
    expect(slowThresholdMs('50')).toBe(50)
    expect(shouldLog(sample, {})).toBe(true)
    expect(shouldLog({ ...sample, ms: 299 }, {})).toBe(false)
    expect(shouldLog({ ...sample, ms: 299 }, { SLOW_FN_MS: '100' })).toBe(true)
  })
  test('TIMING_LOG=1 logs every call', () => {
    expect(shouldLog({ ...sample, ms: 1 }, { TIMING_LOG: '1' })).toBe(true)
  })
  test('log line is structured JSON', () => {
    expect(JSON.parse(formatLogLine(sample))).toEqual({
      event: 'server-fn',
      fn: 'x',
      ms: 400,
      dbMs: 1,
      queries: 1,
    })
  })
})

describe('measureServerFn', () => {
  test('sums DB time and counts queries, sets header, keeps the result', async () => {
    const headers: Array<string> = []
    const lines: Array<string> = []
    const result = await measureServerFn(
      {
        name: 'getThing',
        setHeader: (v) => headers.push(v),
        log: (l) => lines.push(l),
        now: fakeClock(0, 500),
      },
      async () => {
        await sleep(1)
        recordQuery(10)
        await sleep(1)
        recordQuery(5)
        return { body: 1 }
      },
    )
    expect(result).toEqual({ body: 1 })
    expect(headers).toEqual(['fn;dur=500, db;dur=15;desc="2 queries"'])
    expect(lines.map((l) => JSON.parse(l))).toEqual([
      { event: 'server-fn', fn: 'getThing', ms: 500, dbMs: 15, queries: 2 },
    ])
  })

  test('concurrent calls keep separate scopes; fast calls are not logged', async () => {
    const lines: Array<string> = []
    const headers: Record<string, string> = {}
    const run = (name: string, queries: number) =>
      measureServerFn(
        {
          name,
          setHeader: (v) => (headers[name] = v),
          log: (l) => lines.push(l),
          now: fakeClock(0, 5),
        },
        async () => {
          for (let i = 0; i < queries; i++) {
            await sleep(1)
            recordQuery(1)
          }
        },
      )
    await Promise.all([run('a', 1), run('b', 3)])
    expect(headers.a).toContain('desc="1 query"')
    expect(headers.b).toContain('desc="3 queries"')
    expect(lines).toEqual([])
  })

  test('nested calls roll DB totals up into the parent', async () => {
    const headers: Array<string> = []
    await measureServerFn(
      {
        name: 'outer',
        setHeader: (v) => headers.push(v),
        now: fakeClock(0, 1),
      },
      async () => {
        recordQuery(2)
        await measureServerFn(
          { name: 'inner', setHeader: () => {}, now: fakeClock(0, 1) },
          async () => recordQuery(3),
        )
      },
    )
    expect(headers[0]).toContain('db;dur=5;desc="2 queries"')
  })

  test('still reports when the call throws', async () => {
    const headers: Array<string> = []
    await expect(
      measureServerFn(
        {
          name: 'boom',
          setHeader: (v) => headers.push(v),
          now: fakeClock(0, 1),
        },
        async () => {
          throw new Error('x')
        },
      ),
    ).rejects.toThrow('x')
    expect(headers).toHaveLength(1)
  })

  test('a failing header setter never breaks the call', async () => {
    const out = await measureServerFn(
      {
        name: 'n',
        setHeader: () => {
          throw new Error('headers sent')
        },
      },
      async () => 7,
    )
    expect(out).toBe(7)
  })
})

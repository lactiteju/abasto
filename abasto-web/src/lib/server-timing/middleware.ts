import { createMiddleware } from '@tanstack/react-start'
import { appendResponseHeader } from '@tanstack/react-start/server'

import { measureServerFn } from './measure.ts'

/**
 * Global function middleware: adds `Server-Timing` to every server-function
 * response and logs slow calls (`SLOW_FN_MS`, or all with `TIMING_LOG=1`).
 * Registered in `src/start.ts`; the response body is never touched.
 */
export const serverTimingMiddleware = createMiddleware({
  type: 'function',
}).server(({ next, serverFnMeta }) =>
  measureServerFn(
    {
      name: serverFnMeta.name,
      setHeader: (value) => appendResponseHeader('Server-Timing', value),
    },
    () => next(),
  ),
)

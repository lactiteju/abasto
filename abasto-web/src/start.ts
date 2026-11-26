import { createStart } from '@tanstack/react-start'

import { serverTimingMiddleware } from '#/lib/server-timing/middleware'

export const startInstance = createStart(() => ({
  functionMiddleware: [serverTimingMiddleware],
}))

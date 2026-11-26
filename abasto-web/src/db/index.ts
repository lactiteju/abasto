import { drizzle } from 'drizzle-orm/node-postgres'

import * as schema from './schema.ts'
import { instrumentPgQueries } from './timing.ts'

instrumentPgQueries()

export const db = drizzle(process.env.DATABASE_URL!, { schema })

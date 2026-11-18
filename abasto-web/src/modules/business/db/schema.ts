import { sql } from 'drizzle-orm'
import { check, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** The business identity shown across the app: a single row, always `id = 1`. */
export const businessSettings = pgTable(
  'business_settings',
  {
    id: integer('id').primaryKey().default(1),
    name: text('name').notNull(),
    location: text('location').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [check('business_settings_single_row', sql`${table.id} = 1`)],
)

import { sql } from 'drizzle-orm'
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const warehouses = pgTable(
  'warehouses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    /** At most one warehouse is the default: the one opened first. */
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('warehouses_name_unique').on(sql`lower(${table.name})`),
    // Only one default warehouse.
    uniqueIndex('warehouses_single_default')
      .on(table.isDefault)
      .where(sql`${table.isDefault}`),
  ],
)

import { isBusinessDate } from '#/modules/reports/lib/period'
import { weekStartOf } from '#/modules/reports/lib/rider-weekly-week'

/** URL state of "Repartos": the week shown (`almacen` and `proveedor` are shared). */
export type RiderWeeklySearch = {
  /** Monday, YYYY-MM-DD; absent means the current week. */
  semana?: string
}

/** Keeps a well-formed date, snapped to the Monday of its week. */
export function parseRiderWeeklySearch(
  raw: Record<string, unknown>,
): RiderWeeklySearch {
  return typeof raw.semana === 'string' && isBusinessDate(raw.semana)
    ? { semana: weekStartOf(raw.semana) }
    : {}
}

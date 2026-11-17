import type { StatusTone } from '#/components/status-badge'
import { businessDate } from '#/modules/orders/services/clock'
import type { AssignmentStatus } from '#/modules/riders/db/schema'
import { formatCents } from '#/modules/pricing/lib/money'

const tones: Record<AssignmentStatus, StatusTone> = {
  'En ruta': 'blue',
  Liquidada: 'green',
  Cancelada: 'gray',
}

export const statusTone = (status: AssignmentStatus) => tones[status]

/** Shortage or surplus of the cash a rider handed in, in words. */
export function differenceLabel(differenceCents: number) {
  if (differenceCents === 0) return 'Sin diferencia'
  return differenceCents < 0
    ? `Faltante ${formatCents(-differenceCents)}`
    : `Sobrante ${formatCents(differenceCents)}`
}

export type DifferenceTone = 'shortage' | 'surplus' | 'exact'

/** How loud a settlement difference should read. */
export function differenceTone(differenceCents: number): DifferenceTone {
  if (differenceCents < 0) return 'shortage'
  return differenceCents > 0 ? 'surplus' : 'exact'
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`

/**
 * One-line view of a load so a row keeps its height however many products
 * it carries: the first product, how many more, and the total in base units.
 */
export function loadSummary(
  lines: ReadonlyArray<{ productName: string; assignedQuantity: number }>,
) {
  if (!lines.length) return { lead: 'Sin productos', extra: 0, detail: '' }
  const units = lines.reduce((sum, line) => sum + line.assignedQuantity, 0)
  return {
    lead: lines[0].productName,
    extra: lines.length - 1,
    detail: `${plural(lines.length, 'producto', 'productos')} · ${plural(units, 'unidad', 'unidades')}`,
  }
}

const verbs: Record<AssignmentStatus, string> = {
  'En ruta': 'Salió',
  Liquidada: 'Se liquidó',
  Cancelada: 'Se canceló',
}

/** What happened to an assignment and whether it was today (business day). */
export function whenLabel(
  status: AssignmentStatus,
  at: Date | string,
  today: string,
) {
  return { verb: verbs[status], today: businessDate(new Date(at)) === today }
}

/**
 * What Repartos shows by default: everything still "En ruta" (however old)
 * plus what was created or closed today in the business time zone.
 */
export function currentAssignments<
  T extends {
    status: AssignmentStatus
    createdAt: Date
    closedAt: Date | null
  },
>(assignments: ReadonlyArray<T>, today: string): Array<T> {
  return assignments.filter(
    (a) =>
      a.status === 'En ruta' ||
      businessDate(a.createdAt) === today ||
      (a.closedAt !== null && businessDate(a.closedAt) === today),
  )
}

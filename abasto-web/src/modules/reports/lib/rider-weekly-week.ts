/**
 * Calendar of "Repartos": weeks run Monday to Sunday in business dates
 * (YYYY-MM-DD), formatted at UTC noon so no timezone shifts the day.
 */
import { addDays, isBusinessDate } from '#/modules/reports/lib/period'
import type { ReportSupplier } from '#/modules/reports/types/reports'

const atNoon = (day: string) => new Date(`${day}T12:00:00Z`)

const monthLong = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
const monthShort = [
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
]
const weekdayShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** The Monday of the week a day falls in. */
export function weekStartOf(day: string) {
  const sinceMonday = (atNoon(day).getUTCDay() + 6) % 7
  return addDays(day, -sinceMonday)
}

/** Monday to Sunday of the week that starts on `weekStart`. */
export const weekDays = (weekStart: string) =>
  Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

/** Week before (-1) or after (+1). */
export const shiftWeek = (weekStart: string, step: 1 | -1) =>
  addDays(weekStart, step * 7)

/** The week to show: the URL's (snapped to its Monday), else the current one. */
export const weekOf = (semana: string | undefined, today: string) =>
  weekStartOf(isBusinessDate(semana) ? semana : today)

const dayNumber = (day: string) => Number(day.slice(8))
const monthIndex = (day: string) => Number(day.slice(5, 7)) - 1

/** "Semana del 16 al 22 de noviembre"; across months "del 30 de noviembre al 6 de diciembre". */
export function weekHeading(weekStart: string) {
  const end = addDays(weekStart, 6)
  const from = dayNumber(weekStart)
  const to = dayNumber(end)
  if (monthIndex(weekStart) === monthIndex(end)) {
    return `Semana del ${from} al ${to} de ${monthLong[monthIndex(end)]}`
  }
  return `Semana del ${from} de ${monthLong[monthIndex(weekStart)]} al ${to} de ${monthLong[monthIndex(end)]}`
}

/** "16 NOV": the name of a day's sheet. */
export const daySheetName = (day: string) =>
  `${dayNumber(day)} ${monthShort[monthIndex(day)]}`

/** "Lun 16": a day chip. */
export const dayChipLabel = (day: string) =>
  `${weekdayShort[atNoon(day).getUTCDay()]} ${dayNumber(day)}`

/** Route pay per box prorated to the pieces sold, half-up rounded to a cent. */
export const routePayCents = (
  soldUnits: number,
  payPerBoxCents: number,
  boxFactor: number,
) =>
  boxFactor > 0
    ? Math.floor((2 * soldUnits * payPerBoxCents + boxFactor) / (2 * boxFactor))
    : 0

/**
 * Supplier a fresh "Repartos" view opens on: the first whose name contains
 * "lala" (any case); null (every supplier) when none does.
 */
export const defaultSupplier = (
  suppliers: ReadonlyArray<ReportSupplier>,
): ReportSupplier | null =>
  suppliers.find((item) => /lala/i.test(item.name)) ?? null

/** `proveedor=todos` in the URL: the explicit "every supplier" choice. */
export const allSuppliers = 'todos'

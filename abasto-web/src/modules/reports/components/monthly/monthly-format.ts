/** Labels and small calculations of the "Resultados del mes" screen. */
import { boxesLabel } from '#/modules/reports/lib/monthly-results-sheet'

const atNoon = (day: string) => {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date, 12))
}

const weekday = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'UTC',
  weekday: 'short',
})
const monthLong = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'UTC',
  month: 'long',
})

const two = (value: number) => String(value).padStart(2, '0')

/** "lun 02". */
export const dayLabel = (day: string) =>
  `${weekday.format(atNoon(day)).replace('.', '')} ${two(atNoon(day).getUTCDate())}`

export const isSunday = (day: string) => atNoon(day).getUTCDay() === 0

/** "noviembre" for a YYYY-MM month. */
export const monthName = (month: string) =>
  monthLong.format(atNoon(`${month}-01`))

/** "Noviembre 2026". */
export const monthHeading = (month: string) => {
  const name = monthName(month)
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${month.slice(0, 4)}`
}

/** "noviembre 2026": lowercase, for running text and menu labels. */
export const monthLabel = (month: string) =>
  `${monthName(month)} ${month.slice(0, 4)}`

/** "12.5 cajas", "1 caja". */
export const boxesText = (boxes: number) =>
  `${boxesLabel(boxes)} ${boxes === 1 ? 'caja' : 'cajas'}`

/** "mar 03 · 12.5 cajas": what a bar says on hover. */
export const barTooltip = (day: string, boxes: number) =>
  `${dayLabel(day)} · ${boxesText(boxes)}`

/** Share of margin over sales in basis points; 0 without sales. */
export const marginBps = (marginCents: number, revenueCents: number) =>
  revenueCents ? Math.round((marginCents * 10_000) / revenueCents) : 0

/** Bar height in percent of the product's busiest day; at least 6 when sold. */
export const barHeight = (boxes: number, max: number) =>
  boxes > 0 && max > 0 ? Math.max(6, Math.round((boxes / max) * 100)) : 0

/** URL state of "Resultados del mes": the view switch and the month shown. */
export type MonthlySearch = {
  /** Absent means the usual dashboard ("Tablero"). */
  vista?: 'resultados'
  /** YYYY-MM; absent means the current month. */
  mes?: string
}

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/

/** Keeps only a well-formed month and the known view. */
export function parseMonthlySearch(
  raw: Record<string, unknown>,
): MonthlySearch {
  return {
    ...(raw.vista === 'resultados' ? { vista: 'resultados' as const } : {}),
    ...(typeof raw.mes === 'string' && monthPattern.test(raw.mes)
      ? { mes: raw.mes }
      : {}),
  }
}

/** The month to show: the URL's, else the current business month. */
export const monthOf = (search: MonthlySearch, today: string) =>
  search.mes ?? today.slice(0, 7)

/** Month before (-1) or after (+1) a YYYY-MM month. */
export function shiftMonth(month: string, step: 1 | -1) {
  const [year, number] = month.split('-').map(Number)
  const at = year * 12 + (number - 1) + step
  return `${Math.floor(at / 12)}-${String((at % 12) + 1).padStart(2, '0')}`
}

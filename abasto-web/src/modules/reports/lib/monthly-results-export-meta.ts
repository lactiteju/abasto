/** Header lines printed on the monthly exports (Excel and PDF). */
export type MonthlyExportMeta = {
  business: string
  scope: string
  /** Already formatted, e.g. "2026-11-19 10:30". */
  generatedAt: string
  generatedBy?: string
}

const generated = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Mexico_City',
})

/** Builds the export header; `generatedAt` is the moment of the call. */
export const monthlyExportMeta = (
  business: string,
  scope: string,
  generatedBy?: string,
): MonthlyExportMeta => ({
  business,
  scope,
  generatedAt: generated.format(new Date()),
  generatedBy,
})

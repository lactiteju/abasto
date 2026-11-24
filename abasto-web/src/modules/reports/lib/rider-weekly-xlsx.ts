import type { Worksheet } from 'exceljs'
import { downloadBlob } from '#/modules/reports/lib/csv'
import {
  band,
  fill,
  moneyFormat,
  plum,
  xlsxType,
} from '#/modules/reports/lib/monthly-results-xlsx'
import type { MonthlyExportMeta } from '#/modules/reports/lib/monthly-results-export-meta'
import { longDateLabel } from '#/modules/reports/lib/monthly-results-sheet'
import {
  buildWeeklySheets,
  weeklyFilename,
} from '#/modules/reports/lib/rider-weekly-sheet'
import type { WeeklySheet } from '#/modules/reports/lib/rider-weekly-sheet'
import { weekHeading } from '#/modules/reports/lib/rider-weekly-week'
import type { RiderWeeklyReport } from '#/modules/reports/types/rider-weekly'

const grey = 'FF74686A'
const riderFill = 'FF7A4BA3'
const totalFill = 'FFF1EAF6'
const unitsFormat = '#,##0'

/** Fixed columns before the first rider block; the first three stay frozen. */
const leading = [
  'SKU',
  'PZ X CAJA',
  'PRODUCTO',
  'PAGO RUTA X CAJA',
  'PRECIO X PZ',
]
const perRider = ['PZ VENDIDAS', 'VENTA', 'GANANCIA DEPÓSITO', 'GANANCIA RUTA']
const trailing = [
  'TOTAL PZ',
  'PZ MERMA',
  'GANANCIA TOTAL DEPÓSITO',
  'GANANCIA TOTAL RUTA',
  'GANANCIA TOTAL',
]
const frozenColumns = 3
/** Rows above the header: title, subtitle and generation line. */
const titleRows = 3

const dollars = (cents: number) => cents / 100

const columnCount = (model: WeeklySheet) =>
  leading.length + model.riders.length * perRider.length + trailing.length

/** Columns that hold money, 1-based. */
function moneyColumns(model: WeeklySheet) {
  const money = new Set([4, 5])
  model.riders.forEach((_, rider) => {
    const start = leading.length + rider * perRider.length
    for (const offset of [2, 3, 4]) money.add(start + offset)
  })
  const trailStart = columnCount(model) - trailing.length
  for (const offset of [3, 4, 5]) money.add(trailStart + offset)
  return money
}

/** Two header rows: rider names over their four columns, fixed headers merged. */
function writeHeader(sheet: Worksheet, model: WeeklySheet, row: number) {
  const columns = columnCount(model)
  const trailStart = columns - trailing.length + 1
  const top = sheet.getRow(row)
  const sub = sheet.getRow(row + 1)
  top.height = 22
  sub.height = 34
  const merged = (label: string, column: number) => {
    sheet.getCell(row, column).value = label
    sheet.mergeCells(row, column, row + 1, column)
  }
  leading.forEach((label, index) => merged(label, index + 1))
  trailing.forEach((label, index) => merged(label, trailStart + index))
  model.riders.forEach((rider, index) => {
    const start = leading.length + index * perRider.length + 1
    sheet.getCell(row, start).value = rider.label
    sheet.mergeCells(row, start, row, start + perRider.length - 1)
    perRider.forEach((label, offset) => {
      sub.getCell(start + offset).value = label
    })
  })
  for (const line of [top, sub]) {
    for (let column = 1; column <= columns; column += 1) {
      const cell = line.getCell(column)
      const block =
        column > leading.length && column < trailStart
          ? Math.floor((column - leading.length - 1) / perRider.length)
          : 0
      cell.fill = fill(block % 2 === 1 ? riderFill : plum)
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.alignment = {
        vertical: 'middle',
        horizontal: column === 3 ? 'left' : 'center',
        wrapText: true,
      }
    }
  }
}

/** Cells of one product line or of the totals line, in column order. */
function lineValues(
  lead: Array<string | number | null>,
  line: WeeklySheet['totals'],
) {
  return [
    ...lead,
    ...line.byRider.flatMap((rider) => [
      rider.units,
      dollars(rider.revenueCents),
      dollars(rider.depotProfitCents),
      dollars(rider.routeProfitCents),
    ]),
    line.totalUnits,
    line.scrapUnits,
    dollars(line.depotProfitCents),
    dollars(line.routeProfitCents),
    dollars(line.totalProfitCents),
  ]
}

function formatLine(
  row: ReturnType<Worksheet['addRow']>,
  columns: number,
  money: ReadonlySet<number>,
) {
  for (let column = 2; column <= columns; column += 1) {
    const cell = row.getCell(column)
    if (column === 3) continue
    cell.numFmt = money.has(column) ? moneyFormat : unitsFormat
    cell.alignment = { horizontal: column === 2 ? 'center' : 'right' }
  }
}

function writeSheet(
  sheet: Worksheet,
  model: WeeklySheet,
  subtitle: string,
  meta: MonthlyExportMeta,
) {
  sheet.getCell('A1').value = model.title
  sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: plum } }
  sheet.getCell('A2').value = subtitle
  sheet.getCell('A2').font = { bold: true, size: 12 }
  const by = meta.generatedBy ? ` · por ${meta.generatedBy}` : ''
  sheet.getCell('A3').value = `Generado ${meta.generatedAt}${by}`
  sheet.getCell('A3').font = { color: { argb: grey }, size: 9 }

  const headerRow = titleRows + 1
  writeHeader(sheet, model, headerRow)
  sheet.columns = [
    { width: 14 },
    { width: 11 },
    { width: 36 },
    { width: 13 },
    { width: 12 },
    ...model.riders.flatMap(() => [
      { width: 12 },
      { width: 14 },
      { width: 16 },
      { width: 14 },
    ]),
    { width: 11 },
    { width: 11 },
    { width: 17 },
    { width: 15 },
    { width: 16 },
  ]
  const columns = columnCount(model)
  const money = moneyColumns(model)
  model.rows.forEach((item, index) => {
    const row = sheet.addRow(
      lineValues(
        [
          item.sku,
          item.boxFactor,
          item.name,
          dollars(item.routePayPerBoxCents),
          dollars(item.pieceCents),
        ],
        item,
      ),
    )
    formatLine(row, columns, money)
    if (index % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = fill(band)
      })
    }
    row.getCell(columns).font = { bold: true }
  })
  const total = sheet.addRow(
    lineValues(['', null, 'TOTAL', null, null], model.totals),
  )
  formatLine(total, columns, money)
  total.font = { bold: true }
  total.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = fill(totalFill)
    cell.border = { top: { style: 'medium', color: { argb: plum } } }
  })
  sheet.views = [
    { state: 'frozen', xSplit: frozenColumns, ySplit: headerRow + 1 },
  ]
}

/** Bytes of repartos-semana-YYYY-MM-DD.xlsx; ExcelJS loads here, on demand. */
export async function buildRiderWeeklyXlsx(
  report: RiderWeeklyReport,
  meta: MonthlyExportMeta,
): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = meta.business
  for (const model of buildWeeklySheets(report)) {
    const subtitle =
      model.id === 'semanal'
        ? weekHeading(report.weekStart)
        : longDateLabel(model.id)
    writeSheet(workbook.addWorksheet(model.name), model, subtitle, meta)
  }
  return workbook.xlsx.writeBuffer()
}

/** Builds and downloads repartos-semana-YYYY-MM-DD.xlsx. */
export async function downloadRiderWeeklyXlsx(
  report: RiderWeeklyReport,
  meta: MonthlyExportMeta,
) {
  const buffer = await buildRiderWeeklyXlsx(report, meta)
  downloadBlob(
    new Blob([buffer], { type: xlsxType }),
    weeklyFilename(report.weekStart),
  )
}

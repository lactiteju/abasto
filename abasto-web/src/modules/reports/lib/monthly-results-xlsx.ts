import type { Worksheet } from 'exceljs'
import { downloadBlob } from '#/modules/reports/lib/csv'
import {
  boxesFilename,
  boxesSheetName,
  buildBoxesSheet,
  buildDailySheet,
  dailyFilename,
  dailySheetName,
  monthTitle,
} from '#/modules/reports/lib/monthly-results-sheet'
import type { MonthlyExportMeta } from '#/modules/reports/lib/monthly-results-export-meta'
import type { MonthlyResults } from '#/modules/reports/types/monthly-results'

export type { MonthlyExportMeta }

const plum = 'FF5B2A86'
const band = 'FFFFF8F0'
const weekFill = 'FFF1EAF6'
const moneyFormat = '$ #,##0.00'
const boxesFormat = '#,##0.##'
// Daily file: past days without sales keep a numeric 0 that Excel prints as "—".
const quietMoneyFormat = '$ #,##0.00;-$ #,##0.00;"—"'
const quietBoxesFormat = '#,##0.##;-#,##0.##;"—"'
const empty = '—'

const fill = (argb: string) =>
  ({ type: 'pattern', pattern: 'solid', fgColor: { argb } }) as const

const dollars = (cents: number) => cents / 100

/** Business, title, scope and generation lines. Returns the next free row. */
function titleRows(
  sheet: Worksheet,
  results: MonthlyResults,
  meta: MonthlyExportMeta,
) {
  sheet.getCell('A1').value = meta.business
  sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: plum } }
  sheet.getCell('A2').value = monthTitle(results.month)
  sheet.getCell('A2').font = { bold: true, size: 12 }
  sheet.getCell('A3').value = meta.scope
  const by = meta.generatedBy ? ` · por ${meta.generatedBy}` : ''
  sheet.getCell('A4').value = `Generado ${meta.generatedAt}${by}`
  sheet.getCell('A3').font = { color: { argb: 'FF74686A' } }
  sheet.getCell('A4').font = { color: { argb: 'FF74686A' }, size: 9 }
  return 5
}

function styleHeader(sheet: Worksheet, rowNumber: number, columns: number) {
  const row = sheet.getRow(rowNumber)
  row.height = 22
  for (let column = 1; column <= columns; column += 1) {
    const cell = row.getCell(column)
    cell.fill = fill(plum)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = {
      vertical: 'middle',
      horizontal: column === 1 ? 'left' : 'center',
      wrapText: true,
    }
  }
}

function dailyWorksheet(
  sheet: Worksheet,
  results: MonthlyResults,
  meta: MonthlyExportMeta,
) {
  const model = buildDailySheet(results)
  const header = titleRows(sheet, results, meta)
  sheet.getRow(header).values = [...model.columns]
  styleHeader(sheet, header, 4)
  sheet.columns = [{ width: 38 }, { width: 20 }, { width: 20 }, { width: 12 }]
  let banded = false
  for (const item of model.rows) {
    const row = sheet.addRow([
      item.label,
      item.empty ? empty : dollars(item.revenueCents ?? 0),
      item.empty ? empty : dollars(item.marginCents ?? 0),
      item.empty ? empty : (item.boxes ?? 0),
    ])
    for (const column of [2, 3, 4]) {
      const cell = row.getCell(column)
      cell.numFmt =
        column === 4
          ? item.quiet
            ? quietBoxesFormat
            : boxesFormat
          : item.quiet
            ? quietMoneyFormat
            : moneyFormat
      cell.alignment = { horizontal: 'right' }
    }
    if (item.kind === 'week') {
      row.font = { bold: true }
      row.eachCell((cell) => {
        cell.fill = fill(weekFill)
      })
      banded = false
    } else {
      if (banded) {
        row.eachCell((cell) => {
          cell.fill = fill(band)
        })
      }
      banded = !banded
    }
  }
  const total = sheet.addRow([
    model.total.label,
    dollars(model.total.revenueCents),
    dollars(model.total.marginCents),
    model.total.boxes,
  ])
  total.font = { bold: true }
  total.eachCell((cell, column) => {
    cell.border = { top: { style: 'medium', color: { argb: plum } } }
    if (column > 1) {
      cell.numFmt = column === 4 ? boxesFormat : moneyFormat
      cell.alignment = { horizontal: 'right' }
    }
  })
  sheet.views = [{ state: 'frozen', ySplit: header }]
}

function boxesWorksheet(
  sheet: Worksheet,
  results: MonthlyResults,
  meta: MonthlyExportMeta,
) {
  const model = buildBoxesSheet(results)
  const days = model.dayHeaders.length
  const header = titleRows(sheet, results, meta)
  const totalColumns = 1 + days + 3
  sheet.getRow(header).values = [
    model.productHeader,
    ...model.dayHeaders,
    ...model.totalHeaders,
  ]
  styleHeader(sheet, header, totalColumns)
  sheet.columns = [
    { width: 34 },
    ...model.dayHeaders.map(() => ({ width: 6 })),
    { width: 14 },
    { width: 18 },
    { width: 18 },
  ]
  model.rows.forEach((item, index) => {
    const row = sheet.addRow([
      item.name,
      ...item.boxesByDay.map((boxes, column) =>
        model.futureDays[column] ? empty : boxes,
      ),
      item.boxes,
      item.marginPerBoxCents === null ? empty : dollars(item.marginPerBoxCents),
      dollars(item.marginCents),
    ])
    if (index % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = fill(band)
      })
    }
    for (let column = 2; column <= 1 + days + 1; column += 1) {
      row.getCell(column).numFmt = boxesFormat
      row.getCell(column).alignment = { horizontal: 'center' }
    }
    row.getCell(totalColumns - 1).numFmt = moneyFormat
    row.getCell(totalColumns).numFmt = moneyFormat
    row.getCell(totalColumns - 2).font = { bold: true }
  })
  const boxesRow = sheet.addRow([
    'Total cajas vendidas',
    ...model.dayTotals.map((total, column) =>
      model.futureDays[column] ? empty : total,
    ),
    model.totalBoxes,
  ])
  const marginRow = sheet.addRow([
    'Total de ganancia',
    ...Array<string>(days + 2).fill(''),
    dollars(model.totalMarginCents),
  ])
  for (const row of [boxesRow, marginRow]) {
    row.font = { bold: true }
    for (let column = 1; column <= totalColumns; column += 1) {
      const cell = row.getCell(column)
      if (row === boxesRow) {
        cell.border = { top: { style: 'medium', color: { argb: plum } } }
        if (column > 1) {
          cell.numFmt = boxesFormat
          cell.alignment = { horizontal: 'center' }
        }
      }
    }
  }
  marginRow.getCell(totalColumns).numFmt = moneyFormat
  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: header }]
}

const xlsxType =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** One-sheet workbook; ExcelJS loads here, on demand. */
async function build(
  sheetName: string,
  populate: (sheet: Worksheet) => void,
  meta: MonthlyExportMeta,
): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = meta.business
  populate(workbook.addWorksheet(sheetName))
  return workbook.xlsx.writeBuffer()
}

/** Bytes of ventas-diarias-YYYY-MM.xlsx. */
export const buildDailySalesXlsx = (
  results: MonthlyResults,
  meta: MonthlyExportMeta,
) =>
  build(dailySheetName, (sheet) => dailyWorksheet(sheet, results, meta), meta)

/** Bytes of cajas-por-producto-YYYY-MM.xlsx. */
export const buildBoxesXlsx = (
  results: MonthlyResults,
  meta: MonthlyExportMeta,
) =>
  build(boxesSheetName, (sheet) => boxesWorksheet(sheet, results, meta), meta)

/** Builds and downloads ventas-diarias-YYYY-MM.xlsx. */
export async function downloadDailySalesXlsx(
  results: MonthlyResults,
  meta: MonthlyExportMeta,
) {
  const buffer = await buildDailySalesXlsx(results, meta)
  downloadBlob(
    new Blob([buffer], { type: xlsxType }),
    dailyFilename(results.month),
  )
}

/** Builds and downloads cajas-por-producto-YYYY-MM.xlsx. */
export async function downloadBoxesXlsx(
  results: MonthlyResults,
  meta: MonthlyExportMeta,
) {
  const buffer = await buildBoxesXlsx(results, meta)
  downloadBlob(
    new Blob([buffer], { type: xlsxType }),
    boxesFilename(results.month),
  )
}

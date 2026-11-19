import type { MonthlyExportMeta } from '#/modules/reports/lib/monthly-results-xlsx'
import {
  boxesLabel,
  boxesSheetName,
  buildBoxesSheet,
  buildDailySheet,
  dailySheetName,
  monthlyFilename,
  monthTitle,
  moneyLabel,
} from '#/modules/reports/lib/monthly-results-sheet'
import { pdfText } from '#/modules/reports/lib/pdf-render'
import type { MonthlyResults } from '#/modules/reports/types/monthly-results'

const margin = 28
const ink = '#2a1d33'
const muted = '#74686a'
const plum = '#5b2a86'
const band = '#fff8f0'
const weekFill = '#f1eaf6'
const empty = '—'

type Cells = Array<string>

/**
 * Landscape letter PDF with both monthly tables. jsPDF loads here, on the
 * first download. The day matrix uses a small font so every day column of the
 * month fits one page width.
 */
export async function downloadMonthlyResultsPdf(
  results: MonthlyResults,
  meta: MonthlyExportMeta,
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'l' })
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()

  const heading = (title: string, y: number) => {
    doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(plum)
    doc.text(pdfText(meta.business), margin, y)
    doc.setFontSize(11).setTextColor(ink)
    doc.text(pdfText(`${monthTitle(results.month)} · ${title}`), margin, y + 15)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(muted)
    const by = meta.generatedBy ? ` · por ${meta.generatedBy}` : ''
    doc.text(
      pdfText(`${meta.scope} · Generado ${meta.generatedAt}${by}`),
      margin,
      y + 27,
    )
    return y + 36
  }

  const daily = buildDailySheet(results)
  const dailyRows: Array<Cells> = daily.rows.map((row) => [
    row.label,
    row.empty ? empty : moneyLabel(row.revenueCents ?? 0),
    row.empty ? empty : moneyLabel(row.marginCents ?? 0),
  ])
  autoTable(doc, {
    startY: heading(dailySheetName, margin + 8),
    margin: { left: margin, right: margin, bottom: margin + 14 },
    tableWidth: 460,
    head: [[...daily.columns].map(pdfText)],
    body: dailyRows.map((row) => row.map(pdfText)),
    foot: [
      [
        daily.total.label,
        moneyLabel(daily.total.revenueCents),
        moneyLabel(daily.total.marginCents),
      ].map(pdfText),
    ],
    showFoot: 'lastPage',
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      textColor: ink,
      cellPadding: 1.8,
    },
    headStyles: { fillColor: plum, textColor: '#ffffff', fontStyle: 'bold' },
    footStyles: {
      fontStyle: 'bold',
      lineColor: plum,
      lineWidth: { top: 1 },
    },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
    },
    didParseCell: ({ cell, row, section, column }) => {
      if (section === 'head' && column.index > 0) cell.styles.halign = 'right'
      if (section === 'foot' && column.index > 0) cell.styles.halign = 'right'
      if (section !== 'body') return
      if (daily.rows[row.index].kind === 'week') {
        cell.styles.fontStyle = 'bold'
        cell.styles.fillColor = weekFill
      } else if (row.index % 2 === 1) {
        cell.styles.fillColor = band
      }
    },
  })

  doc.addPage()
  const boxes = buildBoxesSheet(results)
  const days = boxes.dayHeaders.length
  const matrixHead: Cells = [
    boxes.productHeader,
    ...boxes.dayHeaders,
    ...boxes.totalHeaders,
  ]
  const matrixBody: Array<Cells> = boxes.rows.map((row) => [
    row.name,
    ...row.boxesByDay.map((value, column) =>
      boxes.futureDays[column]
        ? empty
        : value === null
          ? ''
          : boxesLabel(value),
    ),
    boxesLabel(row.boxes),
    row.marginPerBoxCents === null ? empty : moneyLabel(row.marginPerBoxCents),
    moneyLabel(row.marginCents),
  ])
  const dayStyles = Object.fromEntries(
    Array.from({ length: days }, (_, column) => [
      column + 1,
      { halign: 'center' as const, cellWidth: 'auto' as const },
    ]),
  )
  autoTable(doc, {
    startY: heading(boxesSheetName, margin + 8),
    margin: { left: margin, right: margin, bottom: margin + 14 },
    head: [matrixHead.map(pdfText)],
    body: matrixBody.map((row) => row.map(pdfText)),
    foot: [
      [
        'Total cajas vendidas',
        ...boxes.dayTotals.map((total, column) =>
          boxes.futureDays[column] ? empty : boxesLabel(total),
        ),
        boxesLabel(boxes.totalBoxes),
        '',
        '',
      ].map(pdfText),
      [
        'Total de ganancia',
        ...Array<string>(days + 2).fill(''),
        moneyLabel(boxes.totalMarginCents),
      ].map(pdfText),
    ],
    showFoot: 'lastPage',
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 6.5,
      textColor: ink,
      cellPadding: 2,
      overflow: 'ellipsize',
    },
    headStyles: { fillColor: plum, textColor: '#ffffff', fontStyle: 'bold' },
    footStyles: { fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 110 },
      ...dayStyles,
      [days + 1]: { halign: 'center', cellWidth: 64, fontStyle: 'bold' },
      [days + 2]: { halign: 'right', cellWidth: 84 },
      [days + 3]: { halign: 'right', cellWidth: 64 },
    },
    didParseCell: ({ cell, row, section, column }) => {
      if (section === 'head' && column.index > 0) {
        cell.styles.halign = column.index <= days + 1 ? 'center' : 'right'
      }
      if (section === 'foot') {
        cell.styles.halign =
          column.index === 0
            ? 'left'
            : column.index <= days + 1
              ? 'center'
              : 'right'
        if (row.index === 0) {
          cell.styles.lineColor = plum
          cell.styles.lineWidth = { top: 1 }
        }
      }
      if (section === 'body' && row.index % 2 === 1) {
        cell.styles.fillColor = band
      }
    },
  })

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(muted)
    doc.text(pdfText(meta.business), margin, height - margin + 14)
    doc.text(
      `Página ${page} de ${pages}`,
      width - margin,
      height - margin + 14,
      {
        align: 'right',
      },
    )
  }
  doc.save(monthlyFilename(results.month, 'pdf'))
}

import type { jsPDF } from 'jspdf'
import type autoTableFn from 'jspdf-autotable'
import { pdfText } from '#/modules/reports/lib/pdf-render'
import type { RemissionNote } from '#/modules/counter/lib/remission-note'

const ink = '#2a1d33'
const muted = '#74686a'
const rule = '#ede3d6'
const headFill = '#f6efe6'
const paid = '#2f7d4f'

type Doc = jsPDF
type AutoTable = typeof autoTableFn

/** Spacing of one copy: a full letter page, or half of one. */
type Layout = {
  margin: number
  bodySize: number
  cellPadding: number
  /** Room between the total and the PAGADO stamp. */
  stampGap: number
  /** Signature under the stamp (full) or beside it (half). */
  signatureBeside: boolean
  /** Folio/fecha/cliente/almacén in one column, or two side by side. */
  infoColumns: 1 | 2
}

const fullPage: Layout = {
  margin: 48,
  bodySize: 9,
  cellPadding: 4,
  stampGap: 30,
  signatureBeside: false,
  infoColumns: 1,
}

const halfPage: Layout = {
  margin: 30,
  bodySize: 8.5,
  cellPadding: 3,
  stampGap: 26,
  signatureBeside: true,
  infoColumns: 2,
}

/** Draws one copy from `top`; returns the lowest y it used. */
function drawCopy(
  doc: Doc,
  autoTable: AutoTable,
  note: RemissionNote,
  copy: string,
  top: number,
  {
    margin,
    bodySize,
    cellPadding,
    stampGap,
    signatureBeside,
    infoColumns,
  }: Layout,
) {
  const width = doc.internal.pageSize.getWidth()
  doc.setLineWidth(0.5)
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(ink)
  doc.text(pdfText(note.business), margin, top + margin + 8)
  doc.setFontSize(13)
  doc.text(pdfText(note.title), width - margin, top + margin + 8, {
    align: 'right',
  })
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(muted)
  doc.text(copy, width - margin, top + margin + 22, { align: 'right' })

  let y = top + margin + 40
  doc.setTextColor(ink)
  const info = [
    ['Folio', note.folio],
    ['Fecha', note.date],
    [note.partyLabel ?? 'Cliente', note.customer],
    ['Almacén', note.warehouse],
  ]
  const perColumn = Math.ceil(info.length / infoColumns)
  const columnWidth = (width - 2 * margin) / infoColumns
  for (const [index, [label, value]] of info.entries()) {
    const x = margin + Math.floor(index / perColumn) * columnWidth
    const rowY = y + (index % perColumn) * 14
    doc.setFont('helvetica', 'bold').text(`${label}:`, x, rowY)
    doc.setFont('helvetica', 'normal').text(pdfText(value), x + 62, rowY)
  }
  y += perColumn * 14
  doc.setDrawColor(rule).line(margin, y, width - margin, y)

  autoTable(doc, {
    startY: y + 10,
    margin: { left: margin, right: margin, bottom: margin },
    // Never break a copy across pages: overflow is measured instead.
    pageBreak: 'avoid',
    head: [note.head.map(pdfText)],
    body: note.rows.map((row) => row.map(pdfText)),
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: bodySize,
      textColor: ink,
      cellPadding,
      lineColor: rule,
      lineWidth: { bottom: 0.5 },
    },
    headStyles: { fillColor: headFill, textColor: muted, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 56 },
      2: { halign: 'right', cellWidth: 80 },
      3: { halign: 'right', cellWidth: 80 },
    },
    didParseCell: ({ cell, column, section }) => {
      if (section === 'head' && column.index >= 2) cell.styles.halign = 'right'
    },
  })
  y =
    (doc as Doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY +
    18

  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(ink)
  doc.text(`${note.totalLabel}  ${pdfText(note.total)}`, width - margin, y, {
    align: 'right',
  })
  for (const [label, amount] of note.extraTotals ?? []) {
    y += 14
    doc.setFont('helvetica', 'normal').setFontSize(10)
    doc.text(`${pdfText(label)}  ${pdfText(amount)}`, width - margin, y, {
      align: 'right',
    })
  }
  y += stampGap
  doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(paid)
  doc.text(note.paidMark, margin, y)
  doc.setDrawColor(paid).setLineWidth(1.5)
  doc.rect(margin - 8, y - 24, doc.getTextWidth(note.paidMark) + 16, 34)

  y += signatureBeside ? 0 : 90
  doc.setDrawColor(ink).setLineWidth(0.5)
  doc.line(width - margin - 190, y, width - margin, y)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(muted)
  doc.text(pdfText(note.signature), width - margin - 95, y + 12, {
    align: 'center',
  })
  return y + 12
}

/**
 * The note twice, «Original» for the bosses and «Copia» for the seller: both
 * on one letter sheet (top and bottom half, with a cut line) when a copy fits
 * half a page; otherwise one full page each. Libraries load on first use.
 */
export async function renderRemissionNote(note: RemissionNote): Promise<Doc> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const create = () => new jsPDF({ unit: 'pt', format: 'letter' })
  const doc = create()
  const width = doc.internal.pageSize.getWidth()
  const half = doc.internal.pageSize.getHeight() / 2

  // Measure on a scratch document: jsPDF cannot undo drawing.
  const scratch = create()
  const bottom = drawCopy(scratch, autoTable, note, 'Original', 0, halfPage)
  const fits =
    scratch.getNumberOfPages() === 1 && bottom <= half - halfPage.margin / 2

  if (fits) {
    drawCopy(doc, autoTable, note, 'Original', 0, halfPage)
    doc.setDrawColor(muted).setLineWidth(0.5).setLineDashPattern([4, 4], 0)
    doc.line(halfPage.margin / 2, half, width - halfPage.margin / 2, half)
    doc.setLineDashPattern([], 0)
    drawCopy(doc, autoTable, note, 'Copia', half, halfPage)
  } else {
    ;['Original', 'Copia'].forEach((copy, index) => {
      if (index > 0) doc.addPage()
      drawCopy(doc, autoTable, note, copy, 0, fullPage)
    })
  }
  return doc
}

/** Downloads the note as a PDF. */
export async function downloadRemissionNote(note: RemissionNote) {
  ;(await renderRemissionNote(note)).save(note.filename)
}

import { pdfText } from '#/modules/reports/lib/pdf-render'
import type { RemissionNote } from '#/modules/counter/lib/remission-note'

const margin = 48
const ink = '#2a1d33'
const muted = '#74686a'
const rule = '#ede3d6'
const headFill = '#f6efe6'
const paid = '#2f7d4f'

/**
 * Draws the note on letter paper, twice: «Original» for the bosses and
 * «Copia» for the seller. The PDF libraries load on the first download.
 */
export async function downloadRemissionNote(note: RemissionNote) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const width = doc.internal.pageSize.getWidth()

  ;['Original', 'Copia'].forEach((copy, index) => {
    if (index > 0) doc.addPage()
    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(ink)
    doc.text(pdfText(note.business), margin, margin + 8)
    doc.setFontSize(13)
    doc.text(pdfText(note.title), width - margin, margin + 8, {
      align: 'right',
    })
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(muted)
    doc.text(copy, width - margin, margin + 22, { align: 'right' })

    let y = margin + 40
    doc.setTextColor(ink)
    for (const [label, value] of [
      ['Folio', note.folio],
      ['Fecha', note.date],
      ['Cliente', note.customer],
      ['Almacén', note.warehouse],
    ]) {
      doc.setFont('helvetica', 'bold').text(`${label}:`, margin, y)
      doc.setFont('helvetica', 'normal').text(pdfText(value), margin + 52, y)
      y += 14
    }
    doc.setDrawColor(rule).line(margin, y, width - margin, y)

    autoTable(doc, {
      startY: y + 10,
      margin: { left: margin, right: margin, bottom: margin },
      head: [note.head.map(pdfText)],
      body: note.rows.map((row) => row.map(pdfText)),
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: 9,
        textColor: ink,
        cellPadding: 4,
        lineColor: rule,
        lineWidth: { bottom: 0.5 },
      },
      headStyles: { fillColor: headFill, textColor: muted, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 50 },
        2: { halign: 'right', cellWidth: 80 },
        3: { halign: 'right', cellWidth: 80 },
      },
      didParseCell: ({ cell, column, section }) => {
        if (section === 'head' && column.index >= 2)
          cell.styles.halign = 'right'
      },
    })
    y =
      (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 18

    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(ink)
    doc.text(`${note.totalLabel}  ${pdfText(note.total)}`, width - margin, y, {
      align: 'right',
    })
    y += 30
    doc.setFontSize(22).setTextColor(paid)
    doc.text(note.paidMark, margin, y)
    doc.setDrawColor(paid).setLineWidth(1.5)
    doc.rect(margin - 8, y - 24, 110, 34)

    y += 90
    doc.setDrawColor(ink).setLineWidth(0.5)
    doc.line(width - margin - 190, y, width - margin, y)
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(muted)
    doc.text(pdfText(note.signature), width - margin - 95, y + 12, {
      align: 'center',
    })
  })
  doc.save(note.filename)
}

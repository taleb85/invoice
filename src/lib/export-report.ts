import * as XLSX from 'xlsx'

export type ExportRow = {
  data: string
  numero: string | null
  fornitore: string
  importo: number | null
  stato: string
  sede: string | null
}

export type ExportType = 'fatture' | 'bolle'

/**
 * Export data to Excel (.xlsx)
 */
export function exportToExcel(
  rows: ExportRow[],
  type: ExportType,
  period: string
): void {
  const headers = ['Data', 'Numero', 'Fornitore', 'Importo (£)', 'Stato', 'Sede']

  const data = rows.map(r => [
    r.data,
    r.numero ?? '—',
    r.fornitore,
    r.importo ?? 0,
    r.stato,
    r.sede ?? '—',
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data])

  ws['!cols'] = [
    { wch: 12 }, { wch: 16 }, { wch: 28 },
    { wch: 14 }, { wch: 14 }, { wch: 16 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, type === 'fatture' ? 'Fatture' : 'Bolle')

  const filename = `smart-pair-${type}-${period}.xlsx`
  XLSX.writeFile(wb, filename)
}

/**
 * Export data to PDF
 */
export async function exportToPdf(
  rows: ExportRow[],
  type: ExportType,
  period: string
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape' })

  doc.setFontSize(18)
  doc.setTextColor(34, 211, 238)
  doc.text('Smart Pair', 14, 16)

  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text(
    `${type === 'fatture' ? 'Fatture' : 'Bolle'} — Periodo: ${period}`,
    14, 24
  )
  doc.text(`Generato il: ${new Date().toLocaleDateString('it-IT')}`, 14, 30)

  autoTable(doc, {
    startY: 36,
    head: [['Data', 'Numero', 'Fornitore', 'Importo', 'Stato', 'Sede']],
    body: rows.map(r => [
      r.data,
      r.numero ?? '—',
      r.fornitore,
      r.importo ? `£${r.importo.toFixed(2)}` : '—',
      r.stato,
      r.sede ?? '—',
    ]),
    headStyles: {
      fillColor: [15, 42, 74],
      textColor: [34, 211, 238],
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [245, 248, 255] },
    styles: { fontSize: 9 },
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      `Smart Pair · Invoice Management · Pagina ${i} di ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 8,
      { align: 'center' }
    )
  }

  doc.save(`smart-pair-${type}-${period}.pdf`)
}

/**
 * Calculate totals for the export summary
 */
export function calcExportTotals(rows: ExportRow[]) {
  const total = rows.reduce((sum, r) => sum + (r.importo ?? 0), 0)
  const count = rows.length
  return { total, count }
}

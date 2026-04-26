/**
 * Heuristics to find bolle / fatture whose stored `data` (YYYY-MM-DD) is likely wrong
 * and should be re-scanned with OCR.
 */
export function isSuspiciousDocumentDate(data: string | null | undefined): boolean {
  if (data == null || data === '') return false
  const t = String(data).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return true
  const y = parseInt(t.slice(0, 4), 10)
  const m = parseInt(t.slice(5, 7), 10)
  const d = parseInt(t.slice(8, 10), 10)
  if (m < 1 || m > 12) return true
  if (d < 1 || d > 31) return true
  if (y < 1990) return true
  /** In linea con la query in `/api/admin/fix-ocr-dates` (oltre 2035-12-31) */
  if (t > '2035-12-31') return true
  const today = new Date().toISOString().slice(0, 10)
  if (t > today) return true
  return false
}

/**
 * Coda fornitore / singolo: include documenti oltre alle date sospette, quando mancano
 * numero o importo (allegato presente) — altrimenti "Controllo OCR" non tocca mai bolle
 * con data plausibile ma campi ancora vuoti.
 */
export function bollaNeedsOcrPass(r: {
  data: string
  file_url: string | null
  importo: number | null
  numero_bolla: string | null
}): boolean {
  if (!r.file_url?.trim()) return false
  if (isSuspiciousDocumentDate(r.data)) return true
  if (!r.numero_bolla?.trim()) return true
  if (r.importo == null || Number.isNaN(Number(r.importo))) return true
  return false
}

export function fatturaNeedsOcrPass(r: {
  data: string
  file_url: string | null
  importo: number | null
  numero_fattura: string | null
}): boolean {
  if (!r.file_url?.trim()) return false
  if (isSuspiciousDocumentDate(r.data)) return true
  if (!r.numero_fattura?.trim()) return true
  if (r.importo == null || Number.isNaN(Number(r.importo))) return true
  return false
}

export function resolvedContentTypeFromFetch(url: string, header: string | null): string {
  const h = (header ?? '').toLowerCase()
  if (h.includes('pdf')) return 'application/pdf'
  if (h.includes('jpeg') || h.includes('jpg')) return 'image/jpeg'
  if (h.includes('png')) return 'image/png'
  if (h.includes('webp')) return 'image/webp'
  if (h.includes('gif')) return 'image/gif'
  const u = url.toLowerCase().split('?')[0] ?? ''
  if (u.endsWith('.pdf')) return 'application/pdf'
  if (/\.jpe?g$/i.test(u)) return 'image/jpeg'
  if (u.endsWith('.png')) return 'image/png'
  if (u.endsWith('.webp')) return 'image/webp'
  if (u.endsWith('.gif')) return 'image/gif'
  return h || 'application/octet-stream'
}

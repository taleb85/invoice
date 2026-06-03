import { normalizeNumeroFattura } from '@/lib/fattura-duplicate-check'

export function importoCentsForDupKey(v: number | null | undefined): number | null {
  if (v == null) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

/** Stesso criterio di `bollaDupKey` in check-duplicates (fornitore + data + numero). */
export function bollaDuplicateGroupKey(r: {
  fornitore_id: string | null
  data: string | null
  numero_bolla: string | null
}): string | null {
  const num = normalizeNumeroFattura(r.numero_bolla)
  if (!num || !r.fornitore_id) return null
  const d = (r.data ?? '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  return `${r.fornitore_id}\0${d}\0${num.toLowerCase()}`
}

/** Stesso criterio di `fatturaDupKey` + distinzione nota di credito. */
export function fatturaDuplicateGroupKey(r: {
  fornitore_id: string | null
  numero_fattura: string | null
  importo: number | null
  is_credit_note?: boolean
}): string | null {
  const num = normalizeNumeroFattura(r.numero_fattura)
  if (!num || !r.fornitore_id) return null
  const cents = importoCentsForDupKey(r.importo)
  if (cents == null) return null
  const base = `${r.fornitore_id}\0${cents}\0${num.toLowerCase()}`
  return r.is_credit_note ? `cn:${base}` : `inv:${base}`
}

type SameFileRow = {
  file_url?: string | null
  data?: string | null
  importo?: number | null
  numero_bolla?: string | null
  numero_fattura?: string | null
}

/**
 * Più registrazioni sullo stesso PDF con date, numeri o importi distinti
 * (es. estratto + fattura nello stesso file) — non sono duplicati da eliminare.
 */
export function rowsLookLikeMultiDocInSamePdf(
  rows: SameFileRow[],
  numeroField: 'numero_bolla' | 'numero_fattura',
): boolean {
  if (rows.length < 2) return false
  const url = rows[0]!.file_url?.trim()
  if (!url) return false
  if (!rows.every((r) => r.file_url?.trim() === url)) return false

  const dates = new Set(
    rows
      .map((r) => (r.data ?? '').trim().slice(0, 10))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
  )
  if (dates.size > 1) return true

  const numeros = new Set(
    rows.map((r) => normalizeNumeroFattura(r[numeroField])).filter(Boolean),
  )
  if (numeros.size > 1) return true

  const importi = new Set(
    rows.map((r) => importoCentsForDupKey(r.importo ?? null)).filter((c) => c != null),
  )
  if (importi.size > 1) return true

  return false
}

import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'

export function quantitaFromDocMetadata(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const m = metadata as Record<string, unknown>
  const raw = m.quantita_totale
  if (raw != null && Number.isFinite(Number(raw))) {
    const n = Number(raw)
    return n >= 0 ? n : null
  }
  const lines = m.rekki_lines
  if (!Array.isArray(lines) || !lines.length) return null
  let sum = 0
  let any = false
  for (const line of lines) {
    if (!line || typeof line !== 'object') continue
    const q = (line as { quantita?: unknown }).quantita
    if (q != null && Number.isFinite(Number(q)) && Number(q) >= 0) {
      sum += Number(q)
      any = true
    }
  }
  return any ? Math.round(sum * 1000) / 1000 : null
}

export function quantitaForBollaFromOcr(ocr: {
  tipo_documento?: unknown
  quantita_totale?: number | null
}): number | null {
  const tipo = normalizeTipoDocumento(ocr.tipo_documento)
  if (tipo != null && tipo !== 'bolla_ddt') return null
  const q = ocr.quantita_totale
  if (q == null || !Number.isFinite(Number(q))) return null
  const n = Number(q)
  return n >= 0 ? Math.round(n * 1000) / 1000 : null
}

export function formatBollaQuantita(
  quantita: number | null | undefined,
  locale: string,
): string {
  if (quantita == null || !Number.isFinite(quantita)) return '—'
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(quantita)
}

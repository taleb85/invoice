/** Estrae un candidato numero documento da nome file / oggetto mail (fallback se OCR non ha `numero_fattura`). */
export function extractNumeroFromDocStrings(
  fileName?: string | null,
  oggettoMail?: string | null,
): string | null {
  const fileStem =
    typeof fileName === 'string' && fileName.trim()
      ? fileName.replace(/\.[a-z0-9]{2,5}$/i, '')
      : ''
  const s = `${fileStem} ${oggettoMail ?? ''}`
  if (!s.trim()) return null
  const patterns = [
    /(?:nota|note)[\s._\-]*(?:di\s+)?credito[\s._\-:]*n[°o]?\.?\s*([a-zA-Z0-9][\-/a-zA-Z0-9._]{1,30})/i,
    /credit[\s._\-]*note[\s._\-:]*n[°o]?\.?\s*([a-zA-Z0-9][\-/a-zA-Z0-9._]{1,30})/i,
    /\b(?:CN|NC|CRN)[\s._\-]+([a-zA-Z0-9][\-/a-zA-Z0-9._]{2,30})\b/i,
    /fattura[\s._\-:]*n[°o]?\.?\s*([a-zA-Z0-9][\-/a-zA-Z0-9._]{1,30})/i,
    /(?:ft|fattura|invoice|inv)[\s._\-]*(\d[\d\-/._a-zA-Z]{2,30})/i,
    /(\d{4,20})[\s._\-]*(?:fattura|ft|invoice|inv)/i,
    /numero\s*(?:fattura|documento|doc)[\s:_\-]*([a-zA-Z0-9][\-/a-zA-Z0-9._]{1,30})/i,
    /n[°o]?\.?\s*(?:fattura|doc)[\s._\-:]*([a-zA-Z0-9][\-/a-zA-Z0-9._]{1,30})/i,
    /([A-Z]{2,5}[\s._\-]\d{3,10}(?:[\s._\-]\d{2,4})?)/,
    /(\d{5,20})/,
  ]
  for (const p of patterns) {
    const m = s.match(p)
    if (m?.[1]) {
      let v = m[1].replace(/[^a-zA-Z0-9\-/._]/g, '').trim()
      if (v.length > 30) v = v.slice(0, 30)
      if (v.length >= 2) return v
    }
  }
  return null
}

export function metadataNumeroFattura(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const n = (metadata as Record<string, unknown>).numero_fattura
  return typeof n === 'string' && n.trim() ? n.trim() : null
}

export function resolvePendingDocNumeroFattura(doc: {
  file_name?: string | null
  oggetto_mail?: string | null
  metadata?: unknown
}): string | null {
  return (
    metadataNumeroFattura(doc.metadata) ??
    extractNumeroFromDocStrings(doc.file_name, doc.oggetto_mail)
  )
}

/**
 * Valida un path di ritorno da query `return_to` (stessa app, no open redirect verso siti esterni).
 * Accetta pathname e opzionale query string (es. `/statements?fy=2025`).
 */
export function safeInternalReturnPath(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const s0 = raw.trim()
  if (!s0.startsWith('/') || s0.startsWith('//')) return null
  const q = s0.indexOf('?')
  const pathOnly = q >= 0 ? s0.slice(0, q) : s0
  if (pathOnly.includes('..') || pathOnly.includes('//')) return null
  if (/^\/fornitori\/new(\/.*)?$/i.test(pathOnly)) return null
  if (s0.length > 4096) return null
  return s0
}

/** Aggiunge `return_to` all’href di creazione fornitore se il path è sicuro. */
export function appendReturnToNewFornitoreHref(baseHref: string, returnPath: string | null): string {
  const safe = safeInternalReturnPath(returnPath)
  if (!safe) return baseHref
  const sep = baseHref.includes('?') ? '&' : '?'
  return `${baseHref}${sep}return_to=${encodeURIComponent(safe)}`
}

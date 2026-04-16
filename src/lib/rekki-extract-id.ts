/**
 * Ricava l'ID fornitore Rekki da un URL (app / web Rekki).
 * Non richiede API: incolla il link profilo o ordine se contiene l'ID nel path, query o hash.
 */

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i

function looksLikeRekkiHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return (
    h === 'rekki.com' ||
    h === 'www.rekki.com' ||
    h.endsWith('.rekki.com') ||
    h.endsWith('.rekki.app')
  )
}

function normalizePastedUrl(raw: string): string {
  let s = raw.trim()
  if (!s) return s
  s = s.replace(/^<+|>+$/g, '').replace(/^["']+|["']+$/g, '').trim()
  return s
}

function safeDecodePathSegment(seg: string): string {
  try {
    return decodeURIComponent(seg).trim()
  } catch {
    return seg.trim()
  }
}

function isPlausibleSupplierIdToken(seg: string): boolean {
  const s = seg.trim()
  if (s.length < 4 || s.length > 128) return false
  if (UUID_RE.test(s)) return true
  // slug alfanumerico + trattini (es. acme-srl-123)
  if (/^[a-z0-9][a-z0-9._-]*$/i.test(s) && /[a-z]/i.test(s)) return true
  if (/^\d+$/.test(s) && s.length >= 6) return true
  return false
}

/**
 * Estrae l'ID fornitore Rekki da URL testuale (anche senza schema, con hash `#/…`, trailing slash).
 * Esportato anche come `extractRekkiIdFromUrl` per compatibilità con naming esterno.
 */
export function extractRekkiSupplierIdFromUrl(raw: string): string | null {
  const s0 = normalizePastedUrl(raw)
  if (!s0) return null

  const withProto = s0.includes('://') ? s0 : `https://${s0}`
  let url: URL
  try {
    url = new URL(withProto)
  } catch {
    const u = s0.match(UUID_RE)
    return u ? u[0] : null
  }

  if (!looksLikeRekkiHost(url.hostname)) {
    return null
  }

  const path = url.pathname.replace(/\/+$/, '') || '/'
  const hash = (url.hash ?? '').replace(/^#/, '')

  const pathPatterns = [
    /\/gb\/food-wholesalers\/([^/?#]+)/i,
    /\/(?:[^/]+\/)*(?:supplier|suppliers|vendor|vendors|v|s)\/([^/?#]+)/i,
    /\/profiles?\/([^/?#]+)/i,
    /\/(?:org|organization|organisations)\/([^/?#]+)/i,
    /\/p\/([^/?#]+)/i,
  ]
  for (const re of pathPatterns) {
    const m = path.match(re)
    if (m) {
      const seg = safeDecodePathSegment(m[1] ?? '')
      if (isPlausibleSupplierIdToken(seg)) return seg
    }
  }

  let hashPath = hash.includes('/') ? (hash.split('?')[0] ?? '').trim() : ''
  if (hashPath && !hashPath.startsWith('/')) hashPath = `/${hashPath}`
  if (hashPath) {
    for (const re of pathPatterns) {
      const m = hashPath.match(re)
      if (m) {
        const seg = safeDecodePathSegment(m[1] ?? '')
        if (isPlausibleSupplierIdToken(seg)) return seg
      }
    }
    const hm = hashPath.match(UUID_RE)
    if (hm) return hm[0]
  }

  const searchParamKeys = [
    'supplier_id',
    'supplierId',
    'supplier',
    'id',
    'vendor_id',
    'vendorId',
    'rekki_supplier_id',
    'sid',
  ]
  for (const key of searchParamKeys) {
    const v = url.searchParams.get(key)?.trim()
    if (v && isPlausibleSupplierIdToken(v)) return v
  }

  const hashParams = new URLSearchParams(hash.includes('?') ? hash.slice(hash.indexOf('?')) : '')
  for (const key of searchParamKeys) {
    const v = hashParams.get(key)?.trim()
    if (v && isPlausibleSupplierIdToken(v)) return v
  }

  const parts = path.split('/').filter(Boolean)
  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = safeDecodePathSegment(parts[i] ?? '')
    const um = seg.match(UUID_RE)
    if (um) return um[0]
  }

  const anywhere = s0.match(UUID_RE)
  if (anywhere) return anywhere[0]

  return null
}

/** Alias esplicito per documentazione / import esterni. */
export const extractRekkiIdFromUrl = extractRekkiSupplierIdFromUrl

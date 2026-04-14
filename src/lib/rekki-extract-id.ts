/**
 * Prova a ricavare l'ID fornitore Rekki da un URL (app / web Rekki).
 * Non richiede API: basta incollare il link profilo/ordine se contiene l'ID nel path o nella query.
 */

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i

function looksLikeRekkiHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'rekki.com' || h.endsWith('.rekki.com') || h.endsWith('.rekki.app')
}

export function extractRekkiSupplierIdFromUrl(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  let url: URL
  try {
    url = new URL(s.includes('://') ? s : `https://${s}`)
  } catch {
    return null
  }
  if (!looksLikeRekkiHost(url.hostname)) {
    return null
  }

  const path = url.pathname
  const pathMatch = path.match(
    /\/(?:supplier|suppliers|vendor|vendors|s)\/([^/?#]+)/i,
  )
  if (pathMatch) {
    const seg = decodeURIComponent(pathMatch[1]).trim()
    if (seg.length >= 4 && seg.length <= 128) return seg
  }

  for (const key of ['supplier_id', 'supplierId', 'supplier', 'id', 'vendor_id']) {
    const v = url.searchParams.get(key)?.trim()
    if (v && v.length >= 4 && v.length <= 128) return v
  }

  const parts = path.split('/').filter(Boolean)
  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = decodeURIComponent(parts[i] ?? '').trim()
    const um = seg.match(UUID_RE)
    if (um) return um[0]
  }

  const anywhere = s.match(UUID_RE)
  if (anywhere && looksLikeRekkiHost(url.hostname)) return anywhere[0]

  return null
}

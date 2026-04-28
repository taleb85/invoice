export const SUPPLIER_HINT_SKIP_COOKIE = 'fluxo-supplier-doc-skips'

type SkipsBlob = Record<string, string[]>

const MAX_IDS_PER_SEDE = 80

export const SUPPLIER_HINT_SKIP_COOKIE_OPTS = {
  path: '/' as const,
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 90,
}

export function parseSupplierHintSkipCookie(cookieValue: string | undefined): SkipsBlob {
  if (!cookieValue?.trim()) return {}
  try {
    const o = JSON.parse(cookieValue) as unknown
    if (!o || typeof o !== 'object') return {}
    const out: SkipsBlob = {}
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const sedeKey = typeof k === 'string' ? k.trim() : ''
      if (!sedeKey) continue
      if (!Array.isArray(v)) continue
      const ids = [...new Set(v.filter((id): id is string => typeof id === 'string' && id.length > 0))].slice(
        0,
        MAX_IDS_PER_SEDE,
      )
      out[sedeKey] = ids
    }
    return out
  } catch {
    return {}
  }
}

export function pushSupplierHintSkip(cookieValue: string | undefined, sedeId: string, documentId: string): SkipsBlob {
  const trimmedSede = sedeId.trim()
  const trimmedDoc = documentId.trim()
  const prev = parseSupplierHintSkipCookie(cookieValue)
  if (!trimmedSede || !trimmedDoc) return prev
  const list = [...(prev[trimmedSede] ?? [])]
  if (!list.includes(trimmedDoc)) list.push(trimmedDoc)
  return { ...prev, [trimmedSede]: list.slice(-MAX_IDS_PER_SEDE) }
}

export function serializeSupplierHintSkipCookie(blob: SkipsBlob): string {
  return JSON.stringify(blob)
}

export function skipsForSede(blob: SkipsBlob, sedeId: string): string[] {
  return blob[sedeId.trim()] ?? []
}

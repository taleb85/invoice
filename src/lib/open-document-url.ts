/** Link relativo all’API che reindirizza a un URL firmato Storage (lettura garantita anche se il bucket non è pubblico). */

export function openDocumentUrl(params: {
  bollaId?: string
  fatturaId?: string
  logId?: string
  documentoId?: string
  statementId?: string
  /** Risposta JSON `{ url }` invece del redirect (es. anteprima in iframe). */
  json?: boolean
}): string {
  const q = new URLSearchParams()
  if (params.bollaId) q.set('bolla_id', params.bollaId)
  else if (params.fatturaId) q.set('fattura_id', params.fatturaId)
  else if (params.logId) q.set('log_id', params.logId)
  else if (params.documentoId) q.set('documento_id', params.documentoId)
  else if (params.statementId) q.set('statement_id', params.statementId)
  else return '#'
  if (params.json) q.set('json', '1')
  return `/api/open-document?${q.toString()}`
}

/** Estrae bucket e path oggetto da una public URL Supabase. */
export function parseSupabasePublicStorageUrl(fileUrl: string): { bucket: string; objectPath: string } | null {
  try {
    const u = new URL(fileUrl)
    const m = u.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
    if (!m) return null
    return { bucket: m[1], objectPath: decodeURIComponent(m[2]) }
  } catch {
    return null
  }
}

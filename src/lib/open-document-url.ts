/** Link relativo all’API che reindirizza a un URL firmato Storage (lettura garantita anche se il bucket non è pubblico). */

export function openDocumentUrl(params: {
  bollaId?: string
  fatturaId?: string
  logId?: string
  documentoId?: string
  statementId?: string
  confermaOrdineId?: string
  /** Risposta JSON `{ url }` invece del redirect (es. anteprima in iframe). */
  json?: boolean
}): string {
  const q = new URLSearchParams()
  if (params.bollaId) q.set('bolla_id', params.bollaId)
  else if (params.fatturaId) q.set('fattura_id', params.fatturaId)
  else if (params.logId) q.set('log_id', params.logId)
  else if (params.documentoId) q.set('documento_id', params.documentoId)
  else if (params.statementId) q.set('statement_id', params.statementId)
  else if (params.confermaOrdineId) q.set('conferma_ordine_id', params.confermaOrdineId)
  else return '#'
  if (params.json) q.set('json', '1')
  return `/api/open-document?${q.toString()}`
}

function decodeStoragePath(pathSegment: string): string {
  try {
    return decodeURIComponent(pathSegment)
  } catch {
    return pathSegment
  }
}

/**
 * Estrae bucket e path oggetto da un URL Supabase Storage (public, signed o render).
 * Serve a rigenerare sempre un URL firmato fresco: i link `/object/sign/...?token=...` in DB scadono
 * e il browser può aprire una scheda “nera” nel viewer PDF.
 */
export function parseSupabasePublicStorageUrl(fileUrl: string): { bucket: string; objectPath: string } | null {
  try {
    const u = new URL(fileUrl)
    const pathname = u.pathname

    const publicM = pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
    if (publicM) {
      return { bucket: publicM[1], objectPath: decodeStoragePath(publicM[2]) }
    }

    const signM = pathname.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/)
    if (signM) {
      return { bucket: signM[1], objectPath: decodeStoragePath(signM[2]) }
    }

    const renderM = pathname.match(/\/storage\/v1\/render\/image\/public\/([^/]+)\/(.+)$/)
    if (renderM) {
      return { bucket: renderM[1], objectPath: decodeStoragePath(renderM[2]) }
    }

    const authM = pathname.match(/\/storage\/v1\/object\/authenticated\/([^/]+)\/(.+)$/)
    if (authM) {
      return { bucket: authM[1], objectPath: decodeStoragePath(authM[2]) }
    }

    return null
  } catch {
    return null
  }
}

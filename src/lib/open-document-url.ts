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

export function resolveOpenDocumentHrefs(params: {
  bollaId?: string
  fatturaId?: string
  logId?: string
  documentoId?: string
  statementId?: string
  confermaOrdineId?: string
}): { jsonHref: string; tabHref: string } | null {
  const b = params.bollaId?.trim()
  const f = params.fatturaId?.trim()
  const l = params.logId?.trim()
  const d = params.documentoId?.trim()
  const s = params.statementId?.trim()
  const co = params.confermaOrdineId?.trim()
  const count = [b, f, l, d, s, co].filter(Boolean).length
  if (count !== 1) return null
  if (b) {
    return {
      jsonHref: openDocumentUrl({ bollaId: b, json: true }),
      tabHref: openDocumentUrl({ bollaId: b }),
    }
  }
  if (f) {
    return {
      jsonHref: openDocumentUrl({ fatturaId: f, json: true }),
      tabHref: openDocumentUrl({ fatturaId: f }),
    }
  }
  if (l) {
    return {
      jsonHref: openDocumentUrl({ logId: l, json: true }),
      tabHref: openDocumentUrl({ logId: l }),
    }
  }
  if (d) {
    return {
      jsonHref: openDocumentUrl({ documentoId: d, json: true }),
      tabHref: openDocumentUrl({ documentoId: d }),
    }
  }
  if (s) {
    return {
      jsonHref: openDocumentUrl({ statementId: s, json: true }),
      tabHref: openDocumentUrl({ statementId: s }),
    }
  }
  if (co) {
    return {
      jsonHref: openDocumentUrl({ confermaOrdineId: co, json: true }),
      tabHref: openDocumentUrl({ confermaOrdineId: co }),
    }
  }
  return null
}

function decodeStoragePath(pathSegment: string): string {
  try {
    return decodeURIComponent(pathSegment)
  } catch {
    return pathSegment
  }
}

/** Rimuove newline parassiti dentro URL storage (env multilinea o copy-paste in DB). */
export function normalizeStorageFileUrl(fileUrl: string): string {
  return fileUrl.replace(/[\r\n]+/g, '').trim()
}

/**
 * Estrae bucket e path oggetto da un URL Supabase Storage (public, signed o render).
 * Serve a rigenerare sempre un URL firmato fresco: i link `/object/sign/...?token=...` in DB scadono
 * e il browser può aprire una scheda “nera” nel viewer PDF.
 */
export function parseSupabasePublicStorageUrl(fileUrl: string): { bucket: string; objectPath: string } | null {
  try {
    const u = new URL(normalizeStorageFileUrl(fileUrl))
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

/**
 * Allegati da mail / caricamento manuale per documenti fiscali (fattura, bolla, estratto):
 * solo PDF — niente foto o scansioni immagine.
 */

export const FISCAL_DOCUMENT_CONTENT_TYPES = ['application/pdf'] as const
export const FISCAL_DOCUMENT_EXTENSIONS = ['pdf'] as const

/** Normalizza tipo MIME (es. "application/pdf; charset=binary"). */
function normalizedMime(ct: string | null | undefined): string {
  return (ct ?? '').split(';')[0].trim().toLowerCase()
}

export function isFiscalDocumentAttachment(
  contentType: string | null | undefined,
  filename: string | null | undefined,
): boolean {
  const type = normalizedMime(contentType)
  const ext = (filename ?? '').split('.').pop()?.toLowerCase() ?? ''
  if ((FISCAL_DOCUMENT_EXTENSIONS as readonly string[]).includes(ext)) return true
  return (FISCAL_DOCUMENT_CONTENT_TYPES as readonly string[]).includes(type)
}

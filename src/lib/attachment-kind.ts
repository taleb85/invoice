/** Classifica l’allegato dall’URL (estensione nel path). Utile per distinguere PDF vs foto in elenco bolle. */

export type AttachmentKind = 'pdf' | 'image' | 'other'

export function attachmentKindFromFileUrl(url: string | null | undefined): AttachmentKind | null {
  if (!url?.trim()) return null
  let pathname: string
  try {
    pathname = new URL(url.trim()).pathname
  } catch {
    pathname = url.trim().split('?')[0] ?? ''
  }
  const lastSeg = (pathname.split('/').pop() ?? '').toLowerCase()
  const pathLower = pathname.toLowerCase()

  if (lastSeg.endsWith('.pdf') || /\.pdf(?:\?|$)/i.test(pathLower)) return 'pdf'

  if (
    /\.(jpe?g|png|gif|webp|heic|heif|bmp|tif|tiff)(?:\?.*)?$/i.test(lastSeg) ||
    /\.(jpe?g|png|gif|webp|heic|heif)(?:\?|$)/i.test(pathLower)
  ) {
    return 'image'
  }

  return 'other'
}

/**
 * URL per iframe/object inline: alcuni viewer PDF risparmiano spazio con toolbar ridotta.
 * Il frammento non invalida URL firmati (non viene inviato al server).
 */
export function embedSrcForInlineViewer(url: string, kind: AttachmentKind | null): string {
  const base = url.trim()
  if (!base) return base
  if (kind !== 'pdf') return base
  // URL relative (es. `/api/open-document`): il fragment non va sul PDF dopo redirect.
  if (!/^https?:\/\//i.test(base)) return base
  const hashIdx = base.indexOf('#')
  const withoutHash = hashIdx >= 0 ? base.slice(0, hashIdx) : base
  return `${withoutHash}#toolbar=0`
}

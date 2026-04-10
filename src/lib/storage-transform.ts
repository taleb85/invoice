/**
 * Converte un URL di Supabase Storage nel formato "render/image" con
 * trasformazione automatica (resize + WebP) per risparmiare banda su mobile.
 *
 * Funziona solo su immagini (JPG, PNG, WebP, GIF).
 * Per PDF o URL non riconosciuti restituisce l'URL originale invariato.
 *
 * Richiede il piano Pro di Supabase (Image Transformations).
 * Se non disponibile, l'URL di trasformazione redirecta all'originale.
 */
export function transformImageUrl(
  url: string | null | undefined,
  opts: { width?: number; quality?: number; format?: 'webp' | 'jpeg' | 'png' } = {}
): string {
  if (!url) return ''

  const { width = 800, quality = 80, format = 'webp' } = opts

  // Solo URL Supabase Storage
  if (!url.includes('/storage/v1/object/public/')) return url

  // Non trasformare PDF
  const lower = url.toLowerCase()
  if (lower.endsWith('.pdf') || lower.includes('.pdf?')) return url

  // Converti in URL di trasformazione:
  // .../storage/v1/object/public/<bucket>/<path>
  // →  .../storage/v1/render/image/public/<bucket>/<path>?width=...&quality=...&format=...
  const transformed = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  )

  const separator = transformed.includes('?') ? '&' : '?'
  return `${transformed}${separator}width=${width}&quality=${quality}&format=${format}`
}

/** Versione thumbnail (200px) per anteprime small */
export function thumbnailUrl(url: string | null | undefined): string {
  return transformImageUrl(url, { width: 200, quality: 70, format: 'webp' })
}

/** Versione ottimizzata per mobile (800px) */
export function mobileImageUrl(url: string | null | undefined): string {
  return transformImageUrl(url, { width: 800, quality: 80, format: 'webp' })
}

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseSupabasePublicStorageUrl } from '@/lib/open-document-url'

/** Limite lettura da hash per documenti enormi (evita OOM sul worker). Suffisso distinto sul digest. */
export const STORAGE_FILE_HASH_MAX_BYTES = 25 * 1024 * 1024

const urlDigestCache = new Map<string, Promise<string | null>>()

/**
 * SHA-256 dell’oggetto in Storage riferito da `fileUrl` (public/sign/render/authenticated).
 * Stesso URL → stessa Promise in cache sulla richiesta HTTP.
 *
 * File &gt; `maxBytes`: si hasha solo il prefisso; il digest è suffissato così da non equivalere all’hash pieno.
 */
export function sha256ForSupabaseStoredFileUrl(
  supabase: SupabaseClient,
  fileUrl: string | null | undefined,
  maxBytes: number = STORAGE_FILE_HASH_MAX_BYTES,
): Promise<string | null> {
  const trimmed = fileUrl?.trim()
  if (!trimmed) return Promise.resolve(null)

  const cached = urlDigestCache.get(trimmed)
  if (cached) return cached

  const job = (async (): Promise<string | null> => {
    const parsed = parseSupabasePublicStorageUrl(trimmed)
    if (!parsed) return null

    const { data, error } = await supabase.storage.from(parsed.bucket).download(parsed.objectPath)
    if (error || !data) return null

    try {
      const ab = await data.arrayBuffer()
      const prefixOnly = ab.byteLength > maxBytes
      const slice = prefixOnly ? ab.slice(0, maxBytes) : ab
      const buf = Buffer.from(slice)
      const h = createHash('sha256').update(buf).digest('hex')
      return prefixOnly ? `${h}:pref${maxBytes}` : h
    } catch {
      return null
    }
  })()

  urlDigestCache.set(trimmed, job)
  return job.catch(() => {
    urlDigestCache.delete(trimmed)
    return null
  })
}

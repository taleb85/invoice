import type { SupabaseClient } from '@supabase/supabase-js'
import { parseSupabasePublicStorageUrl } from '@/lib/open-document-url'

const BUCKET = 'documenti' as const

/**
 * Riferimento stabile allo stesso path usato in passato con `getPublicUrl` (bucket "public" nel path),
 * senza chiamare l’API Storage. Il file resta in bucket privato: per lettura HTTP usare
 * `createSignedUrl` o `download` lato service.
 */
export function documentiPublicRefUrl(objectPath: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
  if (!base) return ''
  const pathEnc = objectPath
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/')
  return `${base}/storage/v1/object/public/${BUCKET}/${pathEnc}`
}

/** Download da URL di riferimento (public/sign/authenticated) salvato in DB. */
export async function downloadStorageObjectByFileUrl(
  service: SupabaseClient,
  fileUrl: string
): Promise<{ data: Buffer; contentType: string } | { error: string }> {
  const parsed = parseSupabasePublicStorageUrl(fileUrl.trim())
  if (!parsed) {
    return { error: 'URL storage non riconosciuto' }
  }
  const { data, error } = await service.storage.from(parsed.bucket).download(parsed.objectPath)
  if (error) {
    return { error: error.message }
  }
  const ab = await data.arrayBuffer()
  const contentType = data.type && data.type !== '' ? data.type : 'application/octet-stream'
  return { data: Buffer.from(ab), contentType }
}

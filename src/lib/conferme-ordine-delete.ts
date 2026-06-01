import type { SupabaseClient } from '@supabase/supabase-js'

/** Non rimuove il file Storage se un'altra conferma punta allo stesso URL. */
export async function deleteConfermaOrdineRow(
  supabase: SupabaseClient,
  opts: {
    id: string
    fileUrl: string | null | undefined
    otherFileUrlsStillInUse: Set<string>
  },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('conferme_ordine').delete().eq('id', opts.id)
  if (error) return { error: error.message }

  const url = opts.fileUrl?.trim()
  if (!url || opts.otherFileUrlsStillInUse.has(url)) return { error: null }

  try {
    const u = new URL(url)
    const marker = '/object/public/documenti/'
    const i = u.pathname.indexOf(marker)
    if (i === -1) return { error: null }
    const path = decodeURIComponent(u.pathname.slice(i + marker.length))
    await supabase.storage.from('documenti').remove([path])
  } catch {
    /* ignore storage cleanup */
  }
  return { error: null }
}

export function confermeFileUrlsInUse(
  rows: { id: string; file_url?: string | null }[],
  excludingIds: Set<string>,
): Set<string> {
  const urls = new Set<string>()
  for (const r of rows) {
    if (excludingIds.has(r.id)) continue
    const u = r.file_url?.trim()
    if (u) urls.add(u)
  }
  return urls
}

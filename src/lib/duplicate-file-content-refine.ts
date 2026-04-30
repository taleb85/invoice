import type { SupabaseClient } from '@supabase/supabase-js'
import { sha256ForSupabaseStoredFileUrl } from '@/lib/supabase-storage-file-sha256'

export type RefinableDuplicateGroup<T extends { id: string } = { id: string }> = {
  reason: string
  items: T[]
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let i = 0

  async function worker(): Promise<void> {
    for (;;) {
      const idx = i++
      if (idx >= items.length) return
      results[idx] = await fn(items[idx]!)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

function duplicateReasonSuffixFileIdentical(reason: string): string {
  if (/\ballegato identico\b/u.test(reason)) return reason
  if (/\bstesso file\b/u.test(reason)) return reason
  return `${reason} — stesso allegato`
}

function duplicateReasonLegacyMetadata(reason: string): string {
  if (/\b(solo|\(solo)\s*metadati\b/ui.test(reason)) return reason
  if (/\bnessun\b.*\ballegato\b/ui.test(reason)) return reason
  return `${reason} (solo metadati, allegato assente)`
}

/**
 * Dopo raggruppamento su metadati (numero+fornitore, importo ± giorni…):
 *
 * - Se **nessun** record ha `file_url` valorizzato → si mantiene il gruppo (come prima).
 * - Se **ci sono allegati** → si estraggono solo coppie (o più) con **digest byte identico** su Storage.
 *   Metadati uguali ma file diversi → **non** compaiono come duplicati.
 * - Le righe **senza allegato** in un gruppo misto → sotto‑gruppo separato solo se ≥2 (**stesso ragionamento solo metadati** sulle righe senza file).
 */
export async function refineDuplicateGroupsByIdenticalStoredFiles<T extends { id: string }>(
  supabase: SupabaseClient,
  groups: RefinableDuplicateGroup<T>[],
  fileUrlById: Map<string, string | null | undefined>,
  options?: { concurrency?: number },
): Promise<RefinableDuplicateGroup<T>[]> {
  const concurrency = Math.max(1, Math.min(12, options?.concurrency ?? 8))

  const uniqueUrls = new Set<string>()
  for (const g of groups) {
    for (const it of g.items) {
      const u = fileUrlById.get(it.id)?.trim()
      if (u) uniqueUrls.add(u)
    }
  }

  const urlToHash = new Map<string, string | null>()
  await mapPool(Array.from(uniqueUrls), concurrency, async (url) => {
    const h = await sha256ForSupabaseStoredFileUrl(supabase, url)
    urlToHash.set(url, h)
  })

  const idToDigest = (id: string): string | null => {
    const u = fileUrlById.get(id)?.trim()
    if (!u) return null
    return urlToHash.get(u) ?? null
  }

  const out: RefinableDuplicateGroup<T>[] = []

  for (const g of groups) {
    const withFile: T[] = []
    const withoutFile: T[] = []
    for (const it of g.items) {
      if (fileUrlById.get(it.id)?.trim()) withFile.push(it)
      else withoutFile.push(it)
    }

    if (withFile.length === 0) {
      out.push(g)
      continue
    }

    const byDigest = new Map<string, T[]>()
    for (const it of withFile) {
      const dig = idToDigest(it.id)
      if (dig !== null && dig !== undefined && dig !== '') {
        const arr = byDigest.get(dig) ?? []
        arr.push(it)
        byDigest.set(dig, arr)
      }
    }

    for (const arr of byDigest.values()) {
      if (arr.length < 2) continue
      out.push({
        ...g,
        reason: duplicateReasonSuffixFileIdentical(g.reason),
        items: [...arr],
      })
    }

    if (withoutFile.length >= 2) {
      out.push({
        ...g,
        reason: duplicateReasonLegacyMetadata(g.reason),
        items: [...withoutFile],
      })
    }
  }

  return out
}

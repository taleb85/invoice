import useSWR, { mutate as globalMutate } from 'swr'
import type { Fornitore } from '@/types'

const fornitoriUrl = (sedeId?: string | null) =>
  sedeId ? `/api/fornitori?sede_id=${encodeURIComponent(sedeId)}` : '/api/fornitori'

const fornitoriUrlPattern = (key: unknown) =>
  typeof key === 'string' && key.startsWith('/api/fornitori')

const fetcher = (url: string): Promise<Fornitore[]> =>
  fetch(url).then((r) => (r.ok ? r.json() : []))

/**
 * Shared SWR hook for the fornitori list.
 *
 * SWR deduplication means multiple components calling `useFornitori()` with
 * the same `sedeId` share a single in-flight request and a single cached
 * response — no N requests for the same data.
 *
 * Call `revalidateFornitori()` after create/update/delete mutations to
 * immediately invalidate the cache for all active consumers.
 */
export function useFornitori(sedeId?: string | null) {
  const key = fornitoriUrl(sedeId)
  return useSWR<Fornitore[]>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval:  30_000,
  })
}

/** Invalidate every /api/fornitori cache entry (any sede_id). */
export const revalidateFornitori = () =>
  globalMutate(fornitoriUrlPattern, undefined, { revalidate: true })

/** Invalidate a specific sede's fornitori list. */
export const revalidateFornitoriForSede = (sedeId?: string | null) =>
  globalMutate(fornitoriUrl(sedeId), undefined, { revalidate: true })

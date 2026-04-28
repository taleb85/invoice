import type { SupabaseClient } from '@supabase/supabase-js'

export type EmailBodySupplierHint = {
  displayName: string
  hits: number
  sedeId: string | null
  newFornitoreHref: string
}

type DocRow = {
  sede_id: string | null
  metadata: Record<string, unknown> | null
}

/**
 * Admin: stesso nome fornitore estratto dal corpo email (documenti [DA TESTO EMAIL])
 * comparso almeno 2 volte in coda senza anagrafica — suggerisce di creare il fornitore.
 */
export async function fetchRecurringEmailBodySupplierHints(
  supabase: SupabaseClient,
  opts?: { maxHints?: number; minHits?: number; fetchLimit?: number }
): Promise<EmailBodySupplierHint[]> {
  const maxHints = opts?.maxHints ?? 4
  const minHits = opts?.minHits ?? 2
  const fetchLimit = opts?.fetchLimit ?? 500

  const { data, error } = await supabase
    .from('documenti_da_processare')
    .select('sede_id, metadata')
    .is('fornitore_id', null)
    .in('stato', ['da_associare', 'da_processare', 'in_attesa'])
    .order('created_at', { ascending: false })
    .limit(fetchLimit)

  if (error || !data?.length) return []

  const agg = new Map<string, { name: string; sedeId: string | null; hits: number }>()

  for (const raw of data as DocRow[]) {
    const m = raw.metadata
    if (!m || m.origine_testo_email !== true) continue
    const name = typeof m.ragione_sociale === 'string' ? m.ragione_sociale.trim() : ''
    if (name.length < 2) continue
    const key = `${raw.sede_id ?? 'none'}::${name.toLowerCase()}`
    const prev = agg.get(key)
    if (prev) {
      prev.hits += 1
      continue
    }
    agg.set(key, { name, sedeId: raw.sede_id, hits: 1 })
  }

  const list = [...agg.values()]
    .filter((x) => x.hits >= minHits)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, maxHints)

  return list.map((x) => {
    const q = new URLSearchParams()
    q.set('prefill_nome', x.name)
    if (x.sedeId) q.set('prefill_sede_id', x.sedeId)
    return {
      displayName: x.name.length > 80 ? `${x.name.slice(0, 80)}…` : x.name,
      hits: x.hits,
      sedeId: x.sedeId,
      newFornitoreHref: `/fornitori/new?${q.toString()}`,
    }
  })
}

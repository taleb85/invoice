import type { SupabaseClient } from '@supabase/supabase-js'
import type { Sede } from '@/types'
import { PENDING_DOCUMENTI_STATI } from '@/lib/dashboard-notification-counts'
import { countOcrFailuresBySedeLast48h, sedeSyncUnhealthy } from '@/lib/dashboard-admin-sede-health'

const PAGE = 1000

function countBySedeId(rows: { sede_id: string | null }[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const r of rows) {
    const id = r.sede_id
    if (!id) continue
    m[id] = (m[id] ?? 0) + 1
  }
  return m
}

/** Tutte le righe `sede_id` (PostgREST limita ~1000 per richiesta senza range). */
async function fetchAllSedeIdRows(
  runPage: (from: number, to: number) => PromiseLike<{ data: { sede_id: string | null }[] | null }>
): Promise<{ sede_id: string | null }[]> {
  const out: { sede_id: string | null }[] = []
  let from = 0
  for (;;) {
    const { data } = await runPage(from, from + PAGE - 1)
    const chunk = data ?? []
    out.push(...chunk)
    if (chunk.length < PAGE) break
    from += PAGE
  }
  return out
}

export type SedeAdminOverviewRow = Sede & {
  fornitori: number
  bolleInAttesa: number
  /** Righe tabella `fatture` per sede */
  fatture: number
  /** Documenti in coda (stati pendenti) per sede */
  documentiInCoda: number
  ocrFailures48h: number
  syncUnhealthy: boolean
}

/**
 * Panoramica admin: prima era 4×N query (una sede alla volta).
 * Qui sono 2 + 4 round-trip totali (sedi + OCR map, poi quattro select leggeri su sede_id).
 */
export async function fetchAdminDashboardSediWithStats(
  supabase: SupabaseClient
): Promise<SedeAdminOverviewRow[]> {
  const [{ data: sedi }, ocrMap] = await Promise.all([
    supabase.from('sedi').select('*').order('nome'),
    countOcrFailuresBySedeLast48h(supabase),
  ])

  const list = (sedi ?? []) as Sede[]
  if (list.length === 0) return []

  const ids = list.map((s) => s.id)

  const [fornitoriRows, bolleRows, fattureRows, docRows] = await Promise.all([
    fetchAllSedeIdRows((from, to) =>
      supabase.from('fornitori').select('sede_id').in('sede_id', ids).range(from, to)
    ),
    fetchAllSedeIdRows((from, to) =>
      supabase
        .from('bolle')
        .select('sede_id')
        .in('sede_id', ids)
        .eq('stato', 'in attesa')
        .range(from, to)
    ),
    fetchAllSedeIdRows((from, to) =>
      supabase.from('fatture').select('sede_id').in('sede_id', ids).range(from, to)
    ),
    fetchAllSedeIdRows((from, to) =>
      supabase
        .from('documenti_da_processare')
        .select('sede_id')
        .in('sede_id', ids)
        .in('stato', [...PENDING_DOCUMENTI_STATI])
        .range(from, to)
    ),
  ])

  const fornitoriMap = countBySedeId(fornitoriRows)
  const bolleMap = countBySedeId(bolleRows)
  const fattureMap = countBySedeId(fattureRows)
  const docMap = countBySedeId(docRows)

  return list.map((sede) => {
    const ext = sede as Sede & { last_imap_sync_error?: string | null }
    const ocrN = ocrMap[sede.id] ?? 0
    const docN = docMap[sede.id] ?? 0
    const fatN = fattureMap[sede.id] ?? 0
    return {
      ...sede,
      fornitori: fornitoriMap[sede.id] ?? 0,
      bolleInAttesa: bolleMap[sede.id] ?? 0,
      fatture: fatN,
      documentiInCoda: docN,
      ocrFailures48h: ocrN,
      syncUnhealthy: sedeSyncUnhealthy(ext.last_imap_sync_error, ocrN),
    }
  })
}

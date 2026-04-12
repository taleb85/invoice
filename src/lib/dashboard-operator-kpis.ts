import type { SupabaseClient } from '@supabase/supabase-js'
import {
  countPendingDocumentiForSede,
  countPendingDocumentiSessionScoped,
  countSyncLogErrors24h,
} from '@/lib/dashboard-notification-counts'

export type OperatorDashboardKpis = {
  bolleTotal: number
  bolleInAttesa: number
  fattureCount: number
  documentiPending: number
  /** Documenti con stato da_associare (da abbinare), allineato allo schema DB. */
  documentiDaAssociare: number
  totaleImporto: number
  listinoRows: number
  statementsTotal: number
  statementsWithIssues: number
  erroriRecenti: number
}

/** Soglia data come in POST /api/solleciti (data bolla prima di domani). */
function sollecitoSogliaDateISO(): string {
  const soglia = new Date()
  soglia.setDate(soglia.getDate() + 1)
  return soglia.toISOString().split('T')[0]!
}

/** Fornitori distinti con bolla «in attesa» in scadenza (stessa logica API solleciti). */
export async function countFornitoriWithOverdueBolle(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null
): Promise<number> {
  if (fornitoreIds && fornitoreIds.length === 0) return 0
  const sogliaISO = sollecitoSogliaDateISO()
  let q = supabase
    .from('bolle')
    .select('fornitore_id')
    .eq('stato', 'in attesa')
    .lt('data', sogliaISO)
  if (fornitoreIds?.length) q = q.in('fornitore_id', fornitoreIds)
  const { data, error } = await q
  if (error || !data?.length) return 0
  return new Set((data as { fornitore_id: string }[]).map((r) => r.fornitore_id).filter(Boolean)).size
}

export async function fornitoreIdsForSede(supabase: SupabaseClient, sedeId: string): Promise<string[]> {
  const { data, error } = await supabase.from('fornitori').select('id').eq('sede_id', sedeId)
  if (error) return []
  return (data ?? []).map((r: { id: string }) => r.id)
}

function sumImporti(rows: { importo: number | null }[] | null): number {
  if (!rows?.length) return 0
  return rows.reduce((s, r) => s + (Number(r.importo) || 0), 0)
}

/**
 * KPI dashboard operatore: con `sedeId` i conteggi sono limitati a fornitori / documenti di quella sede.
 * Senza sede si affida all’RLS (stessa visibilità della vecchia `getStats`).
 */
export async function fetchOperatorDashboardKpis(
  supabase: SupabaseClient,
  sedeId: string | null,
  /** Evita una seconda query se già calcolati (es. da `page.tsx`). */
  prefetchedFornitoreIds?: string[] | null
): Promise<OperatorDashboardKpis> {
  const [erroriRecenti, documentiPendingGlobal] = await Promise.all([
    countSyncLogErrors24h(supabase),
    sedeId
      ? countPendingDocumentiForSede(supabase, sedeId)
      : countPendingDocumentiSessionScoped(supabase),
  ])

  const ids =
    prefetchedFornitoreIds !== undefined
      ? prefetchedFornitoreIds
      : sedeId
        ? await fornitoreIdsForSede(supabase, sedeId)
        : null
  const emptyScope = !!(sedeId && ids && ids.length === 0)

  if (emptyScope) {
    const documentiPending = documentiPendingGlobal
    const [{ count: stmtTotal }, { data: stmtRows }, { count: docDaAssoc }] = await Promise.all([
      supabase.from('statements').select('*', { count: 'exact', head: true }).eq('sede_id', sedeId),
      supabase.from('statements').select('missing_rows').eq('sede_id', sedeId),
      supabase
        .from('documenti_da_processare')
        .select('*', { count: 'exact', head: true })
        .eq('sede_id', sedeId)
        .eq('stato', 'da_associare'),
    ])
    const stmts = (stmtRows ?? []) as { missing_rows: number | null }[]
    const statementsWithIssues = stmts.filter((s) => (s.missing_rows ?? 0) > 0).length
    return {
      bolleTotal: 0,
      bolleInAttesa: 0,
      fattureCount: 0,
      documentiPending,
      documentiDaAssociare: docDaAssoc ?? 0,
      totaleImporto: 0,
      listinoRows: 0,
      statementsTotal: stmtTotal ?? 0,
      statementsWithIssues,
      erroriRecenti,
    }
  }

  const fid = ids?.length ? ids : null

  let docDaAssocQ = supabase
    .from('documenti_da_processare')
    .select('*', { count: 'exact', head: true })
    .eq('stato', 'da_associare')
  if (fid?.length) docDaAssocQ = docDaAssocQ.in('fornitore_id', fid)

  const [
    bolleRes,
    bolleAttesaRes,
    fattureCountRes,
    fattureImportiRes,
    listinoRes,
    stmtCountRes,
    stmtIssuesRes,
    docDaAssocRes,
  ] = await Promise.all([
    fid
      ? supabase.from('bolle').select('*', { count: 'exact', head: true }).in('fornitore_id', fid)
      : supabase.from('bolle').select('*', { count: 'exact', head: true }),
    fid
      ? supabase
          .from('bolle')
          .select('*', { count: 'exact', head: true })
          .in('fornitore_id', fid)
          .eq('stato', 'in attesa')
      : supabase.from('bolle').select('*', { count: 'exact', head: true }).eq('stato', 'in attesa'),
    fid
      ? supabase.from('fatture').select('*', { count: 'exact', head: true }).in('fornitore_id', fid)
      : supabase.from('fatture').select('*', { count: 'exact', head: true }),
    fid
      ? supabase.from('fatture').select('importo').in('fornitore_id', fid)
      : supabase.from('fatture').select('importo'),
    fid
      ? supabase.from('listino_prezzi').select('*', { count: 'exact', head: true }).in('fornitore_id', fid)
      : supabase.from('listino_prezzi').select('*', { count: 'exact', head: true }),
    sedeId
      ? supabase.from('statements').select('*', { count: 'exact', head: true }).eq('sede_id', sedeId)
      : supabase.from('statements').select('*', { count: 'exact', head: true }),
    sedeId
      ? supabase
          .from('statements')
          .select('*', { count: 'exact', head: true })
          .eq('sede_id', sedeId)
          .gt('missing_rows', 0)
      : supabase.from('statements').select('*', { count: 'exact', head: true }).gt('missing_rows', 0),
    docDaAssocQ,
  ])

  const statementsTotal = stmtCountRes.count ?? 0
  const statementsWithIssues = stmtIssuesRes.count ?? 0

  return {
    bolleTotal: bolleRes.count ?? 0,
    bolleInAttesa: bolleAttesaRes.count ?? 0,
    fattureCount: fattureCountRes.count ?? 0,
    documentiPending: documentiPendingGlobal,
    documentiDaAssociare: docDaAssocRes.count ?? 0,
    totaleImporto: sumImporti(fattureImportiRes.data as { importo: number | null }[] | null),
    listinoRows: listinoRes.count ?? 0,
    statementsTotal,
    statementsWithIssues,
    erroriRecenti,
  }
}

/** Ultime bolle, opzionalmente limitate ai fornitori della sede. */
export async function fetchRecentBolleScoped(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null
) {
  if (fornitoreIds && fornitoreIds.length === 0) return []
  let q = supabase.from('bolle').select('*, fornitori(nome)').order('created_at', { ascending: false }).limit(5)
  if (fornitoreIds?.length) q = q.in('fornitore_id', fornitoreIds)
  const { data } = await q
  return data ?? []
}


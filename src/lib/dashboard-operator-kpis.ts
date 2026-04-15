import type { SupabaseClient } from '@supabase/supabase-js'
import {
  countPendingDocumentiForSede,
  countPendingDocumentiSessionScoped,
  countSyncLogErrors24h,
} from '@/lib/dashboard-notification-counts'
import { utcBoundsForZonedCalendarDay } from '@/lib/zoned-day-bounds'

export type ListinoOverviewRow = {
  id: string
  fornitore_id: string
  fornitore_nome: string
  prodotto: string
  prezzo: number
  data_prezzo: string
  note: string | null
}

const LISTINO_OVERVIEW_LIMIT = 500

/** Righe `listino_prezzi` con nome fornitore, per la pagina /listino. */
export async function fetchListinoOverviewRows(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null
): Promise<ListinoOverviewRow[]> {
  let q = supabase
    .from('listino_prezzi')
    .select('id, fornitore_id, prodotto, prezzo, data_prezzo, note, fornitori(nome, display_name)')
    .order('data_prezzo', { ascending: false })
    .limit(LISTINO_OVERVIEW_LIMIT)
  if (fornitoreIds?.length) {
    q = q.in('fornitore_id', fornitoreIds)
  }
  const { data, error } = await q
  if (error || !data?.length) return []
  type Fn = { nome?: string | null; display_name?: string | null }
  return (data as Record<string, unknown>[]).map((r) => {
    const fn = r.fornitori as Fn | null
    const label = (fn?.display_name?.trim() || fn?.nome?.trim() || '—') as string
    return {
      id: r.id as string,
      fornitore_id: r.fornitore_id as string,
      fornitore_nome: label,
      prodotto: String(r.prodotto ?? ''),
      prezzo: Number(r.prezzo) || 0,
      data_prezzo: String(r.data_prezzo ?? ''),
      note: (r.note as string | null) ?? null,
    }
  })
}

export type FatturaRiepilogoRow = {
  id: string
  data: string
  importo: number | null
  numero_fattura: string | null
  fornitore_id: string
  fornitore_nome: string
}

const FATTURE_RIEPILOGO_LIMIT = 500

/** Somma importi e conteggio fatture (stesso ambito dei KPI dashboard). */
export async function fetchFattureTotaleSummary(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null
): Promise<{ totaleImporto: number; fattureCount: number }> {
  let q = supabase.from('fatture').select('importo')
  if (fornitoreIds?.length) q = q.in('fornitore_id', fornitoreIds)
  const { data, error } = await q
  if (error) return { totaleImporto: 0, fattureCount: 0 }
  const rows = (data ?? []) as { importo: number | null }[]
  return { totaleImporto: sumImporti(rows), fattureCount: rows.length }
}

/** Ultime fatture per data, per la tabella in /fatture/riepilogo. */
export async function fetchFattureRiepilogoRows(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null
): Promise<FatturaRiepilogoRow[]> {
  let q = supabase
    .from('fatture')
    .select('id, data, importo, numero_fattura, fornitore_id, fornitori(nome, display_name)')
    .order('data', { ascending: false })
    .limit(FATTURE_RIEPILOGO_LIMIT)
  if (fornitoreIds?.length) q = q.in('fornitore_id', fornitoreIds)
  const { data, error } = await q
  if (error || !data?.length) return []
  type Fn = { nome?: string | null; display_name?: string | null }
  return (data as Record<string, unknown>[]).map((r) => {
    const fn = r.fornitori as Fn | null
    const label = (fn?.display_name?.trim() || fn?.nome?.trim() || '—') as string
    return {
      id: r.id as string,
      data: String(r.data ?? ''),
      importo: r.importo != null ? Number(r.importo) : null,
      numero_fattura: (r.numero_fattura as string | null) ?? null,
      fornitore_id: r.fornitore_id as string,
      fornitore_nome: label,
    }
  })
}

export type OrdineOverviewRow = {
  id: string
  fornitore_id: string
  fornitore_nome: string
  titolo: string | null
  data_ordine: string | null
  created_at: string
  file_url: string
  file_name: string | null
}

const ORDINI_OVERVIEW_LIMIT = 200

/** Conferme ordine con nome fornitore, per la pagina /ordini. */
export async function fetchOrdiniOverviewRows(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null
): Promise<OrdineOverviewRow[]> {
  let q = supabase
    .from('conferme_ordine')
    .select('id, fornitore_id, titolo, data_ordine, created_at, file_url, file_name, fornitori(nome, display_name)')
    .order('created_at', { ascending: false })
    .limit(ORDINI_OVERVIEW_LIMIT)
  if (fornitoreIds?.length) q = q.in('fornitore_id', fornitoreIds)
  const { data, error } = await q
  if (error || !data?.length) return []
  type Fn = { nome?: string | null; display_name?: string | null }
  return (data as Record<string, unknown>[]).map((r) => {
    const fn = r.fornitori as Fn | null
    const label = (fn?.display_name?.trim() || fn?.nome?.trim() || '—') as string
    return {
      id: r.id as string,
      fornitore_id: r.fornitore_id as string,
      fornitore_nome: label,
      titolo: (r.titolo as string | null) ?? null,
      data_ordine: r.data_ordine != null ? String(r.data_ordine) : null,
      created_at: String(r.created_at ?? ''),
      file_url: String(r.file_url ?? ''),
      file_name: (r.file_name as string | null) ?? null,
    }
  })
}

export type OperatorDashboardKpis = {
  bolleTotal: number
  bolleInAttesa: number
  /** Fornitori nella sede (o in scope RLS se senza sede). */
  fornitoriCount: number
  fattureCount: number
  documentiPending: number
  /** Documenti con stato da_associare (da abbinare), allineato allo schema DB. */
  documentiDaAssociare: number
  totaleImporto: number
  listinoRows: number
  /** Righe `conferme_ordine` nell’ambito fornitori (o tutte visibili via RLS). */
  ordiniCount: number
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
      fornitoriCount: 0,
      fattureCount: 0,
      documentiPending,
      documentiDaAssociare: docDaAssoc ?? 0,
      totaleImporto: 0,
      listinoRows: 0,
      ordiniCount: 0,
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

  const fornitoriCountQ = sedeId
    ? supabase.from('fornitori').select('*', { count: 'exact', head: true }).eq('sede_id', sedeId)
    : supabase.from('fornitori').select('*', { count: 'exact', head: true })

  const [
    bolleRes,
    bolleAttesaRes,
    fattureCountRes,
    fattureImportiRes,
    listinoRes,
    ordiniRes,
    stmtCountRes,
    stmtIssuesRes,
    docDaAssocRes,
    fornitoriCountRes,
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
    fid
      ? supabase.from('conferme_ordine').select('*', { count: 'exact', head: true }).in('fornitore_id', fid)
      : supabase.from('conferme_ordine').select('*', { count: 'exact', head: true }),
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
    fornitoriCountQ,
  ])

  const statementsTotal = stmtCountRes.count ?? 0
  const statementsWithIssues = stmtIssuesRes.count ?? 0
  const ordiniCount = ordiniRes.error ? 0 : ordiniRes.count ?? 0

  return {
    bolleTotal: bolleRes.count ?? 0,
    bolleInAttesa: bolleAttesaRes.count ?? 0,
    fornitoriCount: fornitoriCountRes.count ?? 0,
    fattureCount: fattureCountRes.count ?? 0,
    documentiPending: documentiPendingGlobal,
    documentiDaAssociare: docDaAssocRes.count ?? 0,
    totaleImporto: sumImporti(fattureImportiRes.data as { importo: number | null }[] | null),
    listinoRows: listinoRes.count ?? 0,
    ordiniCount,
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

export type ScannerFlowDaySummary = { aiElaborate: number; archiviate: number }

export type ScannerFlowEventStep = 'ai_elaborata' | 'archiviata_bolla' | 'archiviata_fattura'

export type ScannerFlowEventRow = {
  id: string
  created_at: string
  step: ScannerFlowEventStep
}

export type ScannerFlowDayDetail = {
  summary: ScannerFlowDaySummary
  events: ScannerFlowEventRow[]
}

const SCANNER_FLOW_TODAY_EVENTS_LIMIT = 20

function isScannerFlowEventStep(s: string): s is ScannerFlowEventStep {
  return s === 'ai_elaborata' || s === 'archiviata_bolla' || s === 'archiviata_fattura'
}

/** Conteggi `scanner_flow_events` per sede nella giornata (fuso `ianaTimeZone`). Tabella assente → zeri. */
export async function fetchTodayScannerFlowSummary(
  supabase: SupabaseClient,
  sedeId: string,
  ianaTimeZone: string
): Promise<ScannerFlowDaySummary> {
  const { start, endExclusive } = utcBoundsForZonedCalendarDay(ianaTimeZone)
  const [aiRes, archRes] = await Promise.all([
    supabase
      .from('scanner_flow_events')
      .select('*', { count: 'exact', head: true })
      .eq('sede_id', sedeId)
      .eq('step', 'ai_elaborata')
      .gte('created_at', start)
      .lt('created_at', endExclusive),
    supabase
      .from('scanner_flow_events')
      .select('*', { count: 'exact', head: true })
      .eq('sede_id', sedeId)
      .in('step', ['archiviata_bolla', 'archiviata_fattura'])
      .gte('created_at', start)
      .lt('created_at', endExclusive),
  ])
  if (aiRes.error || archRes.error) {
    return { aiElaborate: 0, archiviate: 0 }
  }
  return { aiElaborate: aiRes.count ?? 0, archiviate: archRes.count ?? 0 }
}

/** Conteggi giornalieri + ultimi eventi (descrizione attività Scanner AI nella giornata). */
export async function fetchTodayScannerFlowDetail(
  supabase: SupabaseClient,
  sedeId: string,
  ianaTimeZone: string
): Promise<ScannerFlowDayDetail> {
  const { start, endExclusive } = utcBoundsForZonedCalendarDay(ianaTimeZone)
  const [summary, eventsRes] = await Promise.all([
    fetchTodayScannerFlowSummary(supabase, sedeId, ianaTimeZone),
    supabase
      .from('scanner_flow_events')
      .select('id, created_at, step')
      .eq('sede_id', sedeId)
      .gte('created_at', start)
      .lt('created_at', endExclusive)
      .order('created_at', { ascending: false })
      .limit(SCANNER_FLOW_TODAY_EVENTS_LIMIT),
  ])
  if (eventsRes.error || !eventsRes.data) {
    return { summary, events: [] }
  }
  const events: ScannerFlowEventRow[] = []
  for (const row of eventsRes.data) {
    if (row.id && row.created_at && typeof row.step === 'string' && isScannerFlowEventStep(row.step)) {
      events.push({ id: row.id, created_at: row.created_at, step: row.step })
    }
  }
  return { summary, events }
}

const SCANNER_FLOW_EVENTS_PAGE_SIZE = 50

export { SCANNER_FLOW_EVENTS_PAGE_SIZE }

/** Elenco paginato `scanner_flow_events` per sede (tutte le date, più recenti prima). */
export async function fetchScannerFlowEventsPage(
  supabase: SupabaseClient,
  sedeId: string,
  page: number
): Promise<{ rows: ScannerFlowEventRow[]; total: number }> {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1
  const from = (safePage - 1) * SCANNER_FLOW_EVENTS_PAGE_SIZE
  const to = from + SCANNER_FLOW_EVENTS_PAGE_SIZE - 1
  const { data, error, count } = await supabase
    .from('scanner_flow_events')
    .select('id, created_at, step', { count: 'exact' })
    .eq('sede_id', sedeId)
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error || !data) {
    return { rows: [], total: 0 }
  }
  const rows: ScannerFlowEventRow[] = []
  for (const row of data) {
    if (row.id && row.created_at && typeof row.step === 'string' && isScannerFlowEventStep(row.step)) {
      rows.push({ id: row.id, created_at: row.created_at, step: row.step })
    }
  }
  return { rows, total: count ?? rows.length }
}

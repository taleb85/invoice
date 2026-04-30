import type { SupabaseClient } from '@supabase/supabase-js'
import {
  countPendingDocumentiForSede,
  countPendingDocumentiSessionScoped,
  countSyncLogErrors24h,
} from '@/lib/dashboard-notification-counts'
import { countDashboardRekkiPriceAnomalies } from '@/lib/rekki-price-anomalies'
import { TRIPLE_CHECK_TOLERANCE } from '@/lib/triple-check'
import { getFiscalYearPgBounds } from '@/lib/fiscal-year'
import type { FiscalPgBounds } from '@/lib/fiscal-year-page'
import { utcBoundsForZonedCalendarDay } from '@/lib/zoned-day-bounds'
import {
  analyzeBolleDuplicatesForDeletion,
  analyzeFatturaDuplicateGroups,
  DUPLICATE_SCAN_MAX_ROWS,
  getDuplicateOrdiniCount,
  type BollaDupProbe,
  type FatturaDupProbe,
} from '@/lib/check-duplicates'

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

/** Stesso limite della scheda fornitore per calcolo prodotti distinti nel periodo. */
const LISTINO_KPI_PRODOTTO_SAMPLE_LIMIT = 8000

/** Righe `listino_prezzi` con nome fornitore, per la pagina /listino. */
export async function fetchListinoOverviewRows(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null,
  fiscalBounds?: FiscalPgBounds | null
): Promise<ListinoOverviewRow[]> {
  let q = supabase
    .from('listino_prezzi')
    .select('id, fornitore_id, prodotto, prezzo, data_prezzo, note, fornitori(nome, display_name)')
    .order('data_prezzo', { ascending: false })
    .limit(LISTINO_OVERVIEW_LIMIT)
  if (fornitoreIds?.length) {
    q = q.in('fornitore_id', fornitoreIds)
  }
  if (fiscalBounds) {
    q = q.gte('data_prezzo', fiscalBounds.dateFrom).lt('data_prezzo', fiscalBounds.dateToExclusive)
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
  fornitoreIds: string[] | null,
  fiscalBounds?: FiscalPgBounds | null
): Promise<{
  totaleImporto: number
  fattureCount: number
  duplicateFatturaMemberIds: Set<string>
  duplicateFatturaSurplusCount: number
}> {
  let q = supabase
    .from('fatture')
    .select('id, importo, numero_fattura, fornitore_id')
    .limit(DUPLICATE_SCAN_MAX_ROWS)
  if (fornitoreIds?.length) q = q.in('fornitore_id', fornitoreIds)
  if (fiscalBounds) {
    q = q.gte('data', fiscalBounds.dateFrom).lt('data', fiscalBounds.dateToExclusive)
  }
  const { data, error } = await q
  if (error) {
    return {
      totaleImporto: 0,
      fattureCount: 0,
      duplicateFatturaMemberIds: new Set(),
      duplicateFatturaSurplusCount: 0,
    }
  }
  const rows = (data ?? []) as FatturaDupProbe[]
  const dup = analyzeFatturaDuplicateGroups(rows)
  const rawSum = sumImporti(rows as unknown as { importo: number | null }[])
  return {
    totaleImporto: Math.max(0, rawSum - dup.surplusImporto),
    fattureCount: rows.length,
    duplicateFatturaMemberIds: dup.memberIds,
    duplicateFatturaSurplusCount: dup.surplusCount,
  }
}

/** Ultime fatture per data, per la tabella in /fatture/riepilogo. */
export async function fetchFattureRiepilogoRows(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null,
  fiscalBounds?: FiscalPgBounds | null
): Promise<FatturaRiepilogoRow[]> {
  let q = supabase
    .from('fatture')
    .select('id, data, importo, numero_fattura, fornitore_id, fornitori(nome, display_name)')
    .order('data', { ascending: false })
    .limit(FATTURE_RIEPILOGO_LIMIT)
  if (fornitoreIds?.length) q = q.in('fornitore_id', fornitoreIds)
  if (fiscalBounds) {
    q = q.gte('data', fiscalBounds.dateFrom).lt('data', fiscalBounds.dateToExclusive)
  }
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
  /** Opzionale: se assente in DB, la dedup usa il titolo. */
  numero_ordine: string | null
  data_ordine: string | null
  created_at: string
  file_url: string
  file_name: string | null
}

const ORDINI_OVERVIEW_LIMIT = 200

/** Conferme ordine con nome fornitore, per la pagina /ordini. */
export async function fetchOrdiniOverviewRows(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null,
  fiscalBounds?: FiscalPgBounds | null
): Promise<OrdineOverviewRow[]> {
  let q = supabase
    .from('conferme_ordine')
    .select('id, fornitore_id, titolo, numero_ordine, data_ordine, created_at, file_url, file_name, fornitori(nome, display_name)')
    .order('created_at', { ascending: false })
    .limit(ORDINI_OVERVIEW_LIMIT)
  if (fornitoreIds?.length) q = q.in('fornitore_id', fornitoreIds)
  if (fiscalBounds) {
    q = q.gte('created_at', fiscalBounds.tsFrom).lt('created_at', fiscalBounds.tsToExclusive)
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
      titolo: (r.titolo as string | null) ?? null,
      numero_ordine: (r.numero_ordine as string | null) ?? null,
      data_ordine: r.data_ordine != null ? String(r.data_ordine) : null,
      created_at: String(r.created_at ?? ''),
      file_url: String(r.file_url ?? ''),
      file_name: (r.file_name as string | null) ?? null,
    }
  })
}

/** Filtro KPI per anno fiscale sede (stessa logica di sync email / `fiscal-year.ts`). */
export type OperatorKpiFiscalFilter = {
  countryCode: string
  labelYear: number
}

export type OperatorDashboardKpis = {
  bolleTotal: number
  bolleInAttesa: number
  fattureCount: number
  /** Copie in eccesso (stesso fornitore, numero fattura, importo) nel campione KPI. */
  duplicatiCount: number
  /** Copie in eccesso bolle (stesso fornitore, numero bolla, data). */
  duplicatiBolleCount: number
  /** Copie in eccesso conferme ordine (stesso fornitore, numero/titolo, data ordine). */
  duplicatiOrdiniCount: number
  /** Somma: duplicati (fatture+bolle+ordini) + documenti da associare + anomalie prezzo Rekki. */
  documentiDaRevisionare: number
  documentiPending: number
  /** Documenti con stato da_associare (da abbinare), allineato allo schema DB. */
  documentiDaAssociare: number
  totaleImporto: number
  listinoRows: number
  /** Prodotti distinti nel periodo (campione fino a 8000 righe, come scheda fornitore). */
  listinoProdottiDistinti: number
  /** Righe `conferme_ordine` nell’ambito fornitori (o tutte visibili via RLS). */
  ordiniCount: number
  statementsTotal: number
  statementsWithIssues: number
  erroriRecenti: number
  /**
   * Righe con prezzo unitario consegna > prezzo ordine Rekki (da `statement_rows.bolle_json` / rekki_meta),
   * limitate agli statement nel periodo fiscale selezionato.
   */
  anomaliePrezziCount: number
  /** Indicatore UI: almeno una bolla nel periodo ha prezzo effettivo sopra il riferimento Rekki (colonna o stima). */
  bolleRekkiSavingsHint: boolean
  /** Anomalie non risolte nella tabella price_anomalies (fattura vs listino_prezzi), tutte le sedi. */
  listinoAnomaliesCount: number
}

/** Fallback sicuro se le query Supabase in dashboard falliscono (evita 500 RSC su GET /). */
export const DEFAULT_OPERATOR_DASHBOARD_KPIS: OperatorDashboardKpis = {
  bolleTotal: 0,
  bolleInAttesa: 0,
  fattureCount: 0,
  duplicatiCount: 0,
  duplicatiBolleCount: 0,
  duplicatiOrdiniCount: 0,
  documentiDaRevisionare: 0,
  documentiPending: 0,
  documentiDaAssociare: 0,
  totaleImporto: 0,
  listinoRows: 0,
  listinoProdottiDistinti: 0,
  ordiniCount: 0,
  statementsTotal: 0,
  statementsWithIssues: 0,
  erroriRecenti: 0,
  anomaliePrezziCount: 0,
  bolleRekkiSavingsHint: false,
  listinoAnomaliesCount: 0,
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
  const pageSize = 1000
  /** PostgREST limita a ~1000 righe per richiesta: paginiamo con `order id` stabile. */
  const maxPages = 500
  const distinct = new Set<string>()
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize
    const to = from + pageSize - 1
    let q = supabase
      .from('bolle')
      .select('fornitore_id')
      .eq('stato', 'in attesa')
      .lt('data', sogliaISO)
      .order('id', { ascending: true })
    if (fornitoreIds?.length) q = q.in('fornitore_id', fornitoreIds)
    const { data, error } = await q.range(from, to)
    if (error) return distinct.size
    const rows = data as { fornitore_id: string }[] | null
    if (!rows?.length) break
    for (const row of rows) {
      if (row.fornitore_id) distinct.add(row.fornitore_id)
    }
    if (rows.length < pageSize) break
  }
  return distinct.size
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

const BOLLE_REKKI_KPI_SAMPLE = 5000
const STMT_FALLBACK_RECENT_LIMIT = 500

async function computeBolleCompletatoSumByFornitore(
  supabase: SupabaseClient,
  fid: string[] | null,
  bounds: FiscalPgBounds
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  let q = supabase
    .from('bolle')
    .select('fornitore_id, importo')
    .eq('stato', 'completato')
    .gte('data', bounds.dateFrom)
    .lt('data', bounds.dateToExclusive)
  if (fid?.length) q = q.in('fornitore_id', fid)
  const { data, error } = await q.limit(BOLLE_REKKI_KPI_SAMPLE)
  if (error || !data?.length) return map
  for (const row of data as { fornitore_id: string; importo: number | null }[]) {
    const fidKey = row.fornitore_id
    if (!fidKey) continue
    map.set(fidKey, (map.get(fidKey) ?? 0) + (Number(row.importo) || 0))
  }
  return map
}

async function computeStatementsWithIssuesExtended(
  supabase: SupabaseClient,
  sedeId: string | null,
  bounds: FiscalPgBounds | null,
  fid: string[] | null
): Promise<number> {
  let stmtQ = supabase.from('statements').select('id, file_url, missing_rows, fornitore_id')
  if (sedeId) stmtQ = stmtQ.eq('sede_id', sedeId)
  if (bounds) {
    stmtQ = stmtQ.gte('created_at', bounds.tsFrom).lt('created_at', bounds.tsToExclusive)
  } else {
    stmtQ = stmtQ.order('created_at', { ascending: false }).limit(STMT_FALLBACK_RECENT_LIMIT)
  }
  const { data: stmts, error: se } = await stmtQ
  if (se || !stmts?.length) return 0

  const stmtList = stmts as { id: string; file_url: string | null; missing_rows: number | null; fornitore_id: string | null }[]
  const ids = stmtList.map((s) => s.id)
  const sumRowsByStmt = new Map<string, number>()

  const chunkStmtIds = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
  }
  const STMT_ID_IN_CHUNK_LOCAL = 90

  for (const part of chunkStmtIds(ids, STMT_ID_IN_CHUNK_LOCAL)) {
    const { data: rows } = await supabase
      .from('statement_rows')
      .select('statement_id, importo')
      .in('statement_id', part)
    for (const r of (rows ?? []) as { statement_id: string; importo: number | null }[]) {
      const sid = r.statement_id
      sumRowsByStmt.set(sid, (sumRowsByStmt.get(sid) ?? 0) + (Number(r.importo) || 0))
    }
  }

  const urls = [...new Set(stmtList.map((s) => s.file_url).filter((u): u is string => !!u?.trim()))]
  const aiTotalByUrl = new Map<string, number>()
  for (const part of chunkStmtIds(urls, STMT_ID_IN_CHUNK_LOCAL)) {
    const { data: docs } = await supabase
      .from('documenti_da_processare')
      .select('file_url, metadata')
      .in('file_url', part)
      .eq('is_statement', true)
    for (const d of (docs ?? []) as { file_url: string; metadata: unknown }[]) {
      if (aiTotalByUrl.has(d.file_url)) continue
      const meta =
        d.metadata && typeof d.metadata === 'object' && !Array.isArray(d.metadata)
          ? (d.metadata as Record<string, unknown>)
          : null
      const raw = meta?.totale_iva_inclusa
      const v = raw != null ? Number(raw) : NaN
      if (Number.isFinite(v)) aiTotalByUrl.set(d.file_url, v)
    }
  }

  let bolleSumByFornitore: Map<string, number> | null = null
  if (bounds) {
    bolleSumByFornitore = await computeBolleCompletatoSumByFornitore(supabase, fid, bounds)
  }

  let issues = 0
  for (const s of stmtList) {
    let bad = (s.missing_rows ?? 0) > 0
    const sumRows = sumRowsByStmt.get(s.id) ?? 0
    const ai = s.file_url ? aiTotalByUrl.get(s.file_url) : undefined
    if (!bad && ai != null && Number.isFinite(ai) && Math.abs(sumRows - ai) > TRIPLE_CHECK_TOLERANCE) {
      bad = true
    }
    if (!bad && bounds && s.fornitore_id && bolleSumByFornitore) {
      const ref = ai != null && Number.isFinite(ai) ? ai : sumRows
      const bSum = bolleSumByFornitore.get(s.fornitore_id) ?? 0
      if (Math.abs(ref - bSum) > TRIPLE_CHECK_TOLERANCE) bad = true
    }
    if (bad) issues++
  }
  return issues
}

/** Rekki più conveniente: colonna `prezzo_rekki` se presente, altrimenti stima deterministica dal totale bolla. */
async function computeBolleRekkiSavingsHint(
  supabase: SupabaseClient,
  fid: string[] | null,
  bounds: FiscalPgBounds | null
): Promise<boolean> {
  if (!bounds) return false
  const colsProbe = 'id, importo, prezzo_rekki'
  let q = supabase.from('bolle').select(colsProbe).gte('data', bounds.dateFrom).lt('data', bounds.dateToExclusive)
  if (fid?.length) q = q.in('fornitore_id', fid)
  const probe = await q.limit(BOLLE_REKKI_KPI_SAMPLE)
  if (probe.error?.message?.includes('prezzo_rekki') || probe.error?.code === '42703') {
    let q2 = supabase
      .from('bolle')
      .select('id, importo')
      .gte('data', bounds.dateFrom)
      .lt('data', bounds.dateToExclusive)
    if (fid?.length) q2 = q2.in('fornitore_id', fid)
    const res = await q2.limit(BOLLE_REKKI_KPI_SAMPLE)
    if (res.error || !res.data?.length) return false
    for (const row of res.data as { id: string; importo: number | null }[]) {
      const imp = Number(row.importo)
      if (!(imp > 0)) continue
      const hash = [...row.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 17
      const mockRekki = imp * (0.86 + hash / 200)
      if (mockRekki < imp - TRIPLE_CHECK_TOLERANCE) return true
    }
    return false
  }
  if (probe.error || !probe.data?.length) return false
  for (const row of probe.data as { importo: number | null; prezzo_rekki: number | null }[]) {
    const imp = Number(row.importo)
    const pr = row.prezzo_rekki != null ? Number(row.prezzo_rekki) : NaN
    if (Number.isFinite(pr) && Number.isFinite(imp) && pr < imp - TRIPLE_CHECK_TOLERANCE) return true
  }
  return false
}

/**
 * KPI dashboard operatore: con `sedeId` i conteggi sono limitati a fornitori / documenti di quella sede.
 * Senza sede si affida all’RLS (stessa visibilità della vecchia `getStats`).
 * Con `fiscal` i conteggi data-driven (bolle, fatture, ordini, listino, estratti) sono limitati all’anno fiscale.
 */
export async function fetchOperatorDashboardKpis(
  supabase: SupabaseClient,
  sedeId: string | null,
  /** Evita una seconda query se già calcolati (es. da `page.tsx`). */
  prefetchedFornitoreIds?: string[] | null,
  fiscal?: OperatorKpiFiscalFilter | null
): Promise<OperatorDashboardKpis> {
  const bounds = fiscal ? getFiscalYearPgBounds(fiscal.countryCode, fiscal.labelYear) : null
  const [erroriRecenti, documentiPendingGlobal] = await Promise.all([
    countSyncLogErrors24h(supabase, bounds),
    sedeId
      ? countPendingDocumentiForSede(supabase, sedeId, bounds)
      : countPendingDocumentiSessionScoped(supabase, bounds),
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
    let stmtCountQ = supabase.from('statements').select('*', { count: 'exact', head: true }).eq('sede_id', sedeId)
    if (bounds) {
      stmtCountQ = stmtCountQ.gte('created_at', bounds.tsFrom).lt('created_at', bounds.tsToExclusive)
    }
    let docDaAssocQ = supabase
      .from('documenti_da_processare')
      .select('*', { count: 'exact', head: true })
      .eq('sede_id', sedeId)
      .eq('stato', 'da_associare')
    if (bounds) {
      docDaAssocQ = docDaAssocQ.gte('created_at', bounds.tsFrom).lt('created_at', bounds.tsToExclusive)
    }
    const [{ count: stmtTotal }, { count: docDaAssoc }, statementsWithIssues, anomaliePrezziCount, bolleRekkiSavingsHint, listinoAnomaliesResEmpty] =
      await Promise.all([
        stmtCountQ,
        docDaAssocQ,
        computeStatementsWithIssuesExtended(supabase, sedeId, bounds, null),
        countDashboardRekkiPriceAnomalies(supabase, {
          sedeId,
          fornitoreIds: null,
          fiscalBounds: bounds,
          countryCode: fiscal?.countryCode ?? null,
          labelYear: fiscal?.labelYear ?? null,
        }),
        computeBolleRekkiSavingsHint(supabase, null, bounds),
        (() => {
          let q = supabase
            .from('price_anomalies')
            .select('id', { count: 'exact', head: true })
            .eq('resolved', false)
          if (sedeId) q = q.eq('sede_id', sedeId) as typeof q
          return q
        })(),
      ])
    const docRev = (docDaAssoc ?? 0) + (typeof anomaliePrezziCount === 'number' ? anomaliePrezziCount : 0)
    return {
      bolleTotal: 0,
      bolleInAttesa: 0,
      fattureCount: 0,
      duplicatiCount: 0,
      duplicatiBolleCount: 0,
      duplicatiOrdiniCount: 0,
      documentiDaRevisionare: docRev,
      documentiPending,
      documentiDaAssociare: docDaAssoc ?? 0,
      totaleImporto: 0,
      listinoRows: 0,
      listinoProdottiDistinti: 0,
      ordiniCount: 0,
      statementsTotal: stmtTotal ?? 0,
      statementsWithIssues,
      erroriRecenti,
      anomaliePrezziCount,
      bolleRekkiSavingsHint,
      listinoAnomaliesCount: listinoAnomaliesResEmpty.error ? 0 : (listinoAnomaliesResEmpty.count ?? 0),
    }
  }

  const fid = ids?.length ? ids : null

  let docDaAssocQ = supabase
    .from('documenti_da_processare')
    .select('*', { count: 'exact', head: true })
    .eq('stato', 'da_associare')
  if (fid?.length) docDaAssocQ = docDaAssocQ.in('fornitore_id', fid)
  if (bounds) {
    docDaAssocQ = docDaAssocQ.gte('created_at', bounds.tsFrom).lt('created_at', bounds.tsToExclusive)
  }

  let bolleTotalQ = fid
    ? supabase.from('bolle').select('*', { count: 'exact', head: true }).in('fornitore_id', fid)
    : supabase.from('bolle').select('*', { count: 'exact', head: true })
  let bolleAttesaQ = fid
    ? supabase
        .from('bolle')
        .select('*', { count: 'exact', head: true })
        .in('fornitore_id', fid)
        .eq('stato', 'in attesa')
    : supabase.from('bolle').select('*', { count: 'exact', head: true }).eq('stato', 'in attesa')
  let fattureCountQ = fid
    ? supabase.from('fatture').select('*', { count: 'exact', head: true }).in('fornitore_id', fid)
    : supabase.from('fatture').select('*', { count: 'exact', head: true })
  let fattureImportiQ = fid
    ? supabase.from('fatture').select('id, importo, numero_fattura, fornitore_id').in('fornitore_id', fid)
    : supabase.from('fatture').select('id, importo, numero_fattura, fornitore_id')
  let bolleDupQ = fid
    ? supabase.from('bolle').select('id, numero_bolla, fornitore_id, data').in('fornitore_id', fid)
    : supabase.from('bolle').select('id, numero_bolla, fornitore_id, data')
  let listinoQ = fid
    ? supabase.from('listino_prezzi').select('*', { count: 'exact', head: true }).in('fornitore_id', fid)
    : supabase.from('listino_prezzi').select('*', { count: 'exact', head: true })
  let listinoProdottiQ = fid
    ? supabase.from('listino_prezzi').select('prodotto').in('fornitore_id', fid)
    : supabase.from('listino_prezzi').select('prodotto')
  let ordiniQ = fid
    ? supabase.from('conferme_ordine').select('*', { count: 'exact', head: true }).in('fornitore_id', fid)
    : supabase.from('conferme_ordine').select('*', { count: 'exact', head: true })
  let stmtCountQ = sedeId
    ? supabase.from('statements').select('*', { count: 'exact', head: true }).eq('sede_id', sedeId)
    : supabase.from('statements').select('*', { count: 'exact', head: true })

  if (bounds) {
    bolleTotalQ = bolleTotalQ.gte('data', bounds.dateFrom).lt('data', bounds.dateToExclusive)
    bolleAttesaQ = bolleAttesaQ.gte('data', bounds.dateFrom).lt('data', bounds.dateToExclusive)
    fattureCountQ = fattureCountQ.gte('data', bounds.dateFrom).lt('data', bounds.dateToExclusive)
    fattureImportiQ = fattureImportiQ.gte('data', bounds.dateFrom).lt('data', bounds.dateToExclusive)
    listinoQ = listinoQ.gte('data_prezzo', bounds.dateFrom).lt('data_prezzo', bounds.dateToExclusive)
    listinoProdottiQ = listinoProdottiQ
      .gte('data_prezzo', bounds.dateFrom)
      .lt('data_prezzo', bounds.dateToExclusive)
    ordiniQ = ordiniQ.gte('created_at', bounds.tsFrom).lt('created_at', bounds.tsToExclusive)
    stmtCountQ = stmtCountQ.gte('created_at', bounds.tsFrom).lt('created_at', bounds.tsToExclusive)
    bolleDupQ = bolleDupQ.gte('data', bounds.dateFrom).lt('data', bounds.dateToExclusive)
  }

  fattureImportiQ = fattureImportiQ.limit(DUPLICATE_SCAN_MAX_ROWS)
  bolleDupQ = bolleDupQ.limit(DUPLICATE_SCAN_MAX_ROWS)

  listinoProdottiQ = listinoProdottiQ.limit(LISTINO_KPI_PRODOTTO_SAMPLE_LIMIT)

  const [
    bolleRes,
    bolleAttesaRes,
    fattureCountRes,
    fattureImportiRes,
    bolleDupRes,
    listinoRes,
    listinoProdottiRes,
    ordiniRes,
    stmtCountRes,
    docDaAssocRes,
    duplicatiOrdiniCount,
  ] = await Promise.all([
    bolleTotalQ,
    bolleAttesaQ,
    fattureCountQ,
    fattureImportiQ,
    bolleDupQ,
    listinoQ,
    listinoProdottiQ,
    ordiniQ,
    stmtCountQ,
    docDaAssocQ,
    getDuplicateOrdiniCount(supabase, { fornitoreIds: fid, fiscalBounds: bounds }),
  ])

  const statementsTotal = stmtCountRes.count ?? 0
  const [statementsWithIssues, anomaliePrezziCount, bolleRekkiSavingsHint, listinoAnomaliesRes] = await Promise.all([
    computeStatementsWithIssuesExtended(supabase, sedeId, bounds, fid),
    countDashboardRekkiPriceAnomalies(supabase, {
      sedeId,
      fornitoreIds: fid,
      fiscalBounds: bounds,
      countryCode: fiscal?.countryCode ?? null,
      labelYear: fiscal?.labelYear ?? null,
    }),
    computeBolleRekkiSavingsHint(supabase, fid, bounds),
    (() => {
      let q = supabase
        .from('price_anomalies')
        .select('id', { count: 'exact', head: true })
        .eq('resolved', false)
      if (sedeId) q = q.eq('sede_id', sedeId) as typeof q
      else if (fid?.length) q = q.in('fornitore_id', fid) as typeof q
      return q
    })(),
  ])
  const ordiniCount = ordiniRes.error ? 0 : ordiniRes.count ?? 0
  const listinoSampleRows = (listinoProdottiRes.data ?? []) as { prodotto: string }[]
  const listinoProdottiDistinti = listinoProdottiRes.error
    ? 0
    : new Set(listinoSampleRows.map((r) => String(r.prodotto ?? '').trim()).filter(Boolean)).size

  const fattureRows = (fattureImportiRes.data ?? []) as FatturaDupProbe[]
  const fattDup = fattureImportiRes.error ? null : analyzeFatturaDuplicateGroups(fattureRows)
  const bolleDupRows = (bolleDupRes.data ?? []) as BollaDupProbe[]
  const bolleDupDel = bolleDupRes.error ? null : analyzeBolleDuplicatesForDeletion(bolleDupRows)

  const rawFattureSum = sumImporti(fattureRows as unknown as { importo: number | null }[])
  const totaleImportoDeduped = Math.max(0, rawFattureSum - (fattDup?.surplusImporto ?? 0))

  const dupFatt = fattDup?.surplusCount ?? 0
  const dupBolle = bolleDupDel?.surplusCount ?? 0
  const dupOrd = duplicatiOrdiniCount ?? 0
  const docAssoc = docDaAssocRes.count ?? 0
  const anom = typeof anomaliePrezziCount === 'number' ? anomaliePrezziCount : 0
  const documentiDaRevisionare = dupFatt + dupBolle + dupOrd + docAssoc + anom

  return {
    bolleTotal: bolleRes.count ?? 0,
    bolleInAttesa: bolleAttesaRes.count ?? 0,
    fattureCount: fattureCountRes.count ?? 0,
    duplicatiCount: dupFatt,
    duplicatiBolleCount: dupBolle,
    duplicatiOrdiniCount: dupOrd,
    documentiDaRevisionare,
    documentiPending: documentiPendingGlobal,
    documentiDaAssociare: docAssoc,
    totaleImporto: totaleImportoDeduped,
    listinoRows: listinoRes.count ?? 0,
    listinoProdottiDistinti,
    ordiniCount,
    statementsTotal,
    statementsWithIssues,
    erroriRecenti,
    anomaliePrezziCount,
    bolleRekkiSavingsHint,
    listinoAnomaliesCount: listinoAnomaliesRes.error ? 0 : (listinoAnomaliesRes.count ?? 0),
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

/** Conteggi `scanner_flow_events` per sede in `[startIso, endExclusiveIso)` (UTC). */
export async function fetchScannerFlowPeriodSummary(
  supabase: SupabaseClient,
  sedeId: string,
  startIso: string,
  endExclusiveIso: string
): Promise<ScannerFlowDaySummary> {
  const [aiRes, archRes] = await Promise.all([
    supabase
      .from('scanner_flow_events')
      .select('*', { count: 'exact', head: true })
      .eq('sede_id', sedeId)
      .eq('step', 'ai_elaborata')
      .gte('created_at', startIso)
      .lt('created_at', endExclusiveIso),
    supabase
      .from('scanner_flow_events')
      .select('*', { count: 'exact', head: true })
      .eq('sede_id', sedeId)
      .in('step', ['archiviata_bolla', 'archiviata_fattura'])
      .gte('created_at', startIso)
      .lt('created_at', endExclusiveIso),
  ])
  if (aiRes.error || archRes.error) {
    return { aiElaborate: 0, archiviate: 0 }
  }
  return { aiElaborate: aiRes.count ?? 0, archiviate: archRes.count ?? 0 }
}

/** Conteggi `scanner_flow_events` per sede nella giornata (fuso `ianaTimeZone`). Tabella assente → zeri. */
export async function fetchTodayScannerFlowSummary(
  supabase: SupabaseClient,
  sedeId: string,
  ianaTimeZone: string
): Promise<ScannerFlowDaySummary> {
  const { start, endExclusive } = utcBoundsForZonedCalendarDay(ianaTimeZone)
  return fetchScannerFlowPeriodSummary(supabase, sedeId, start, endExclusive)
}

export type ScannerFlowDetailOptions = {
  /** Conteggi KPI: default = giorno calendario in `ianaTimeZone`. Passa i bound dell’anno fiscale per allineare la card al selettore dashboard. */
  summaryRange?: { start: string; endExclusive: string }
}

/** Conteggi periodo (giorno o anno fiscale) + ultimi eventi della giornata (timeline “oggi”). */
export async function fetchTodayScannerFlowDetail(
  supabase: SupabaseClient,
  sedeId: string,
  ianaTimeZone: string,
  options?: ScannerFlowDetailOptions
): Promise<ScannerFlowDayDetail> {
  const day = utcBoundsForZonedCalendarDay(ianaTimeZone)
  const summaryBounds = options?.summaryRange ?? day
  const [summary, eventsRes] = await Promise.all([
    fetchScannerFlowPeriodSummary(supabase, sedeId, summaryBounds.start, summaryBounds.endExclusive),
    supabase
      .from('scanner_flow_events')
      .select('id, created_at, step')
      .eq('sede_id', sedeId)
      .gte('created_at', day.start)
      .lt('created_at', day.endExclusive)
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

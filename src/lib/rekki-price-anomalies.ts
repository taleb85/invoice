/**
 * Single source of truth for “prezzo consegna vs riferimento Rekki” anomalies:
 * - righe `statement_rows.bolle_json` con `rekki_meta` (confronto unitario),
 * - oppure `bolle.importo` > `bolle.prezzo_rekki` quando la colonna è valorizzata.
 *
 * Usato dalla dashboard operatore (`fetchOperatorDashboardKpis`) e dalla scheda fornitore.
 * In dashboard con FY selezionato: include anche gli statement dell’FY precedente (ordini Rekki)
 * e conta solo voci `bolle_json` la cui `data` cade nel FY corrente (confronto con bolle del periodo).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { TRIPLE_CHECK_TOLERANCE } from '@/lib/triple-check'
import type { FiscalPgBounds } from '@/lib/fiscal-year-page'
import { getFiscalYearPgBounds } from '@/lib/fiscal-year'

const STMT_ID_IN_CHUNK = 90
const BOLLE_PREZZO_REKKI_SAMPLE_LIMIT = 8000
const FY_MIN_FOR_PRIOR_STMT = 1991

export type DateBounds = { dateFrom: string; dateToExclusive: string }

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** True se uno statement “cade” nel periodo calendario `[from, toExclusive)` (stessa logica della scheda fornitore). */
export function statementMatchesCalendarWindow(
  row: { received_at: string; extracted_pdf_dates: unknown },
  from: string,
  toExclusive: string,
): boolean {
  const rec = String(row.received_at ?? '').slice(0, 10)
  if (rec >= from && rec < toExclusive) return true
  const pdf = row.extracted_pdf_dates as { issued_date?: string | null } | null | undefined
  const issued = pdf?.issued_date?.trim()
  if (issued && issued >= from && issued < toExclusive) return true
  return false
}

/**
 * Conta elementi in `bolle_json` dove il prezzo unitario implicito (importo/qty) supera
 * `rekki_meta.prezzo_unitario` (ordine Rekki collegato alla riga estratto).
 */
export function countRekkiBollaUnitPriceAnomaliesInBolleJson(
  bolleJson: unknown,
  /** Se impostato, conta solo voci la cui `data` bolla cade in `[dateFrom, dateToExclusive)`. */
  bollaDateBounds?: DateBounds | null,
): number {
  if (!bolleJson || !Array.isArray(bolleJson)) return 0
  let n = 0
  for (const raw of bolleJson) {
    if (!raw || typeof raw !== 'object') continue
    const elem = raw as Record<string, unknown>
    if (bollaDateBounds) {
      const d = String(elem.data ?? '').slice(0, 10)
      if (!d || d < bollaDateBounds.dateFrom || d >= bollaDateBounds.dateToExclusive) continue
    }
    const meta = elem.rekki_meta
    if (!meta || typeof meta !== 'object') continue
    const m = meta as Record<string, unknown>
    const pu = Number(m.prezzo_unitario)
    const qty = Number(m.quantita)
    if (!Number.isFinite(pu) || pu <= 0) continue
    const q = Number.isFinite(qty) && qty > 0 ? qty : 1
    const imp = Number(elem.importo)
    const unitBolla = Number.isFinite(imp) ? imp / q : NaN
    if (Number.isFinite(unitBolla) && unitBolla > pu + 1e-6) n++
  }
  return n
}

/** Senza anno fiscale selezionato, evita scan illimitato su `statements`. */
const STMT_FALLBACK_RECENT_LIMIT = 500

type StatementScope = {
  sedeId: string | null
  /** Se valorizzato, limita agli estratti di questi fornitori (admin sede / listino fornitori). */
  fornitoreIds: string[] | null
  fiscalBounds: FiscalPgBounds | null
}

async function sumStatementJsonAnomaliesForStatementIds(
  supabase: SupabaseClient,
  statementIds: string[],
  bollaDateBounds?: DateBounds | null,
): Promise<number> {
  if (!statementIds.length) return 0
  let total = 0
  for (const part of chunkArray(statementIds, STMT_ID_IN_CHUNK)) {
    const { data: rows, error: re } = await supabase
      .from('statement_rows')
      .select('bolle_json')
      .in('statement_id', part)
    if (re || !rows?.length) continue
    for (const r of rows as { bolle_json: unknown }[]) {
      total += countRekkiBollaUnitPriceAnomaliesInBolleJson(r.bolle_json, bollaDateBounds ?? null)
    }
  }
  return total
}

async function collectStatementIdsForDashboardAnomalies(
  supabase: SupabaseClient,
  opts: {
    sedeId: string | null
    fornitoreIds: string[] | null
    fiscalBounds: FiscalPgBounds | null
    /** Statement dell’anno fiscale precedente (es. ordini Rekki 2025 vs bolle datate FY 2026). */
    priorFiscalStatementBounds: FiscalPgBounds | null
  },
): Promise<string[]> {
  const { sedeId, fornitoreIds, fiscalBounds, priorFiscalStatementBounds } = opts
  const run = async (fb: FiscalPgBounds | null) => {
    let stmtQ = supabase.from('statements').select('id')
    if (sedeId) stmtQ = stmtQ.eq('sede_id', sedeId)
    if (fornitoreIds?.length) stmtQ = stmtQ.in('fornitore_id', fornitoreIds)
    if (fb) {
      stmtQ = stmtQ.gte('created_at', fb.tsFrom).lt('created_at', fb.tsToExclusive)
    } else {
      stmtQ = stmtQ.order('created_at', { ascending: false }).limit(STMT_FALLBACK_RECENT_LIMIT)
    }
    const { data: stmts, error: se } = await stmtQ
    if (se || !stmts?.length) return [] as string[]
    return (stmts as { id: string }[]).map((s) => s.id).filter(Boolean)
  }

  if (!fiscalBounds) {
    return run(null)
  }

  const current = await run(fiscalBounds)
  if (!priorFiscalStatementBounds) return current

  const prior = await run(priorFiscalStatementBounds)
  return [...new Set([...current, ...prior])]
}

/**
 * Anomalie da righe estratto (Rekki / triple-check) nel periodo fiscale o negli ultimi statement.
 * Allinea la dashboard al filtro fornitori della sede quando `fornitoreIds` è valorizzato.
 */
export async function countRekkiUnitAnomaliesFromStatements(
  supabase: SupabaseClient,
  opts: StatementScope & {
    /** Solo righe `bolle_json` con `data` in questo intervallo (tipico: FY bolle corrente). */
    bollaDateBounds?: DateBounds | null
    countryCode?: string | null
    labelYear?: number | null
  },
): Promise<number> {
  const { sedeId, fornitoreIds, fiscalBounds, bollaDateBounds, countryCode, labelYear } = opts

  let priorFiscalStatementBounds: FiscalPgBounds | null = null
  if (
    fiscalBounds &&
    countryCode &&
    labelYear != null &&
    Number.isFinite(labelYear) &&
    labelYear > FY_MIN_FOR_PRIOR_STMT
  ) {
    priorFiscalStatementBounds = getFiscalYearPgBounds(countryCode, Math.floor(labelYear) - 1)
  }

  const ids = await collectStatementIdsForDashboardAnomalies(supabase, {
    sedeId,
    fornitoreIds,
    fiscalBounds,
    priorFiscalStatementBounds,
  })
  if (!ids.length) return 0

  const window =
    fiscalBounds != null
      ? (bollaDateBounds ?? {
          dateFrom: fiscalBounds.dateFrom,
          dateToExclusive: fiscalBounds.dateToExclusive,
        })
      : null

  return sumStatementJsonAnomaliesForStatementIds(supabase, ids, window)
}

/**
 * Bolle nel periodo (`data`) con `prezzo_rekki` valorizzato e importo effettivo superiore al riferimento.
 */
export async function countBolleImportOverPrezzoRekki(
  supabase: SupabaseClient,
  opts: {
    fornitoreIds: string[] | null
    bounds: DateBounds | null
    sedeId?: string | null
  },
): Promise<number> {
  const { fornitoreIds, bounds, sedeId } = opts
  let q = supabase.from('bolle').select('id, importo, prezzo_rekki, fornitore_id, sede_id')
  if (fornitoreIds?.length) q = q.in('fornitore_id', fornitoreIds)
  if (sedeId) q = q.eq('sede_id', sedeId)
  if (bounds) {
    q = q.gte('data', bounds.dateFrom).lt('data', bounds.dateToExclusive)
  }
  const { data, error } = await q.limit(BOLLE_PREZZO_REKKI_SAMPLE_LIMIT)
  if (error) {
    if (error.code === '42703' || error.message?.includes('prezzo_rekki')) return 0
    return 0
  }
  let n = 0
  for (const row of (data ?? []) as { importo: number | null; prezzo_rekki: number | null }[]) {
    const imp = Number(row.importo)
    const pr = row.prezzo_rekki != null ? Number(row.prezzo_rekki) : NaN
    if (!Number.isFinite(imp) || !Number.isFinite(pr)) continue
    if (imp > pr + TRIPLE_CHECK_TOLERANCE) n++
  }
  return n
}

/** Totale anomalie prezzo Rekki per la dashboard (estratto + colonne bolla). */
export async function countDashboardRekkiPriceAnomalies(
  supabase: SupabaseClient,
  opts: {
    sedeId: string | null
    fornitoreIds: string[] | null
    fiscalBounds: FiscalPgBounds | null
    /** Con `fiscalBounds`, abilita statement FY-1 (ordini Rekki) vs bolle datate nel FY corrente. */
    countryCode?: string | null
    labelYear?: number | null
  },
): Promise<number> {
  const dateBounds =
    opts.fiscalBounds != null
      ? { dateFrom: opts.fiscalBounds.dateFrom, dateToExclusive: opts.fiscalBounds.dateToExclusive }
      : null
  const [fromStatements, fromBolle] = await Promise.all([
    countRekkiUnitAnomaliesFromStatements(supabase, {
      sedeId: opts.sedeId,
      fornitoreIds: opts.fornitoreIds,
      fiscalBounds: opts.fiscalBounds,
      bollaDateBounds: dateBounds,
      countryCode: opts.countryCode ?? null,
      labelYear: opts.labelYear ?? null,
    }),
    countBolleImportOverPrezzoRekki(supabase, {
      fornitoreIds: opts.fornitoreIds,
      bounds: dateBounds,
      sedeId: opts.sedeId,
    }),
  ])
  return fromStatements + fromBolle
}

/**
 * Scheda fornitore — mese calendario: statement nel periodo (received_at / PDF) + bolle per `data`.
 */
export async function countSupplierMonthRekkiPriceAnomalies(
  supabase: SupabaseClient,
  fornitoreId: string,
  from: string,
  toExclusive: string,
): Promise<number> {
  const { data: stmts, error } = await supabase
    .from('statements')
    .select('id, received_at, extracted_pdf_dates')
    .eq('fornitore_id', fornitoreId)
    .order('received_at', { ascending: false })
    .limit(2000)
  if (error || !stmts?.length) {
    return countBolleImportOverPrezzoRekki(supabase, {
      fornitoreIds: [fornitoreId],
      bounds: { dateFrom: from, dateToExclusive: toExclusive },
      sedeId: null,
    })
  }
  const ids = (stmts as { id: string; received_at: string; extracted_pdf_dates: unknown }[])
    .filter((s) => statementMatchesCalendarWindow(s, from, toExclusive))
    .map((s) => s.id)
  const fromJson = await sumStatementJsonAnomaliesForStatementIds(supabase, ids, null)
  const fromBolle = await countBolleImportOverPrezzoRekki(supabase, {
    fornitoreIds: [fornitoreId],
    bounds: { dateFrom: from, dateToExclusive: toExclusive },
    sedeId: null,
  })
  return fromJson + fromBolle
}

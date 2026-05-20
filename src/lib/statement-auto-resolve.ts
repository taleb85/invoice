import type { SupabaseClient } from '@supabase/supabase-js'
import { runTripleCheck, type StatementLine, TRIPLE_CHECK_TOLERANCE, amountsMatchForTripleCheck } from '@/lib/triple-check'

export type AutoRisolviStatementResult = {
  statementsProcessed: number
  righeRivalutate: number
  righeOk: number
  /** Rows closed by fast-path (fattura_id already linked, delta=0). */
  fastFixed: number
  righeAncoraAnomale: number
  falseErrorsFixed: number
  falseErrorsOk: number
  rounds: number
  errors: string[]
}

type StatementRef = { id: string; fornitore_id: string | null; sede_id: string | null }

const IN_CHUNK = 80

function parseStatementJoin(
  raw: { id: string; fornitore_id: string | null; sede_id: string | null } | Array<{ id: string; fornitore_id: string | null; sede_id: string | null }> | null,
): StatementRef | null {
  if (!raw) return null
  const s = Array.isArray(raw) ? raw[0] : raw
  return s?.id ? s : null
}

/** Conta righe statement non ok per sede (query a chunk, senza .in() gigante). */
export async function countAnomalousStatementRows(
  supabase: SupabaseClient,
  sedeId: string,
): Promise<number> {
  const { data: statements } = await supabase
    .from('statements')
    .select('id')
    .eq('sede_id', sedeId)

  const ids = (statements ?? []).map((s) => s.id)
  if (ids.length === 0) return 0

  let total = 0
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK)
    const { count, error } = await supabase
      .from('statement_rows')
      .select('*', { count: 'exact', head: true })
      .in('statement_id', chunk)
      .neq('check_status', 'ok')

    if (error) {
      console.error('[statement-auto-resolve] count chunk error:', error.message)
      continue
    }
    total += count ?? 0
  }
  return total
}

export type FornitoreConFattureMancanti = {
  fornitoreId: string
  fornitoreNome: string | null
  count: number
  /** Data minima delle righe anomale (YYYY-MM-DD). */
  minData: string | null
  /** Data massima delle righe anomale (YYYY-MM-DD). */
  maxData: string | null
}

/**
 * Restituisce i fornitori che hanno righe `fattura_mancante` negli estratti conto della sede,
 * con numero di righe e finestra date — utile per lanciare scansioni IMAP mirate.
 */
export async function getFornitoriConFattureMancanti(
  supabase: SupabaseClient,
  sedeId: string,
): Promise<FornitoreConFattureMancanti[]> {
  const { data: statements } = await supabase
    .from('statements')
    .select('id, fornitore_id, fornitori(nome)')
    .eq('sede_id', sedeId)

  if (!statements?.length) return []

  const stmtMap = new Map<
    string,
    { fornitoreId: string | null; fornitoreNome: string | null }
  >()
  for (const s of statements) {
    const nome =
      s.fornitori && !Array.isArray(s.fornitori)
        ? (s.fornitori as { nome: string }).nome
        : Array.isArray(s.fornitori)
          ? (s.fornitori[0] as { nome: string } | undefined)?.nome ?? null
          : null
    stmtMap.set(s.id, { fornitoreId: s.fornitore_id ?? null, fornitoreNome: nome })
  }

  const ids = [...stmtMap.keys()]
  const byFornitore = new Map<
    string,
    { nome: string | null; count: number; minData: string | null; maxData: string | null }
  >()

  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK)
    const { data: rows } = await supabase
      .from('statement_rows')
      .select('statement_id, data_doc')
      .in('statement_id', chunk)
      .eq('check_status', 'fattura_mancante')

    for (const row of rows ?? []) {
      const meta = stmtMap.get(row.statement_id)
      if (!meta?.fornitoreId) continue
      const fid = meta.fornitoreId
      const prev = byFornitore.get(fid) ?? { nome: meta.fornitoreNome, count: 0, minData: null, maxData: null }
      prev.count++
      const d = row.data_doc ?? null
      if (d) {
        prev.minData = prev.minData === null || d < prev.minData ? d : prev.minData
        prev.maxData = prev.maxData === null || d > prev.maxData ? d : prev.maxData
      }
      byFornitore.set(fid, prev)
    }
  }

  return [...byFornitore.entries()].map(([fornitoreId, v]) => ({
    fornitoreId,
    fornitoreNome: v.nome,
    count: v.count,
    minData: v.minData,
    maxData: v.maxData,
  }))
}

async function loadStatementsForSede(supabase: SupabaseClient, sedeId: string): Promise<StatementRef[]> {
  const { data } = await supabase
    .from('statements')
    .select('id, fornitore_id, sede_id')
    .eq('sede_id', sedeId)
  return data ?? []
}

async function loadStatementIdsWithAnomalies(
  supabase: SupabaseClient,
  sedeId: string,
  /** When true, only returns statements with actionable anomalies (bolle_mancanti / errore_importo).
   *  fattura_mancante rows cannot be auto-resolved and are skipped to save time. */
  skipFatturaMancante = false,
): Promise<StatementRef[]> {
  const byId = new Map<string, StatementRef>()

  let query = supabase
    .from('statement_rows')
    .select('statement_id, statements!inner(id, fornitore_id, sede_id)')
    .eq('statements.sede_id', sedeId)
    .neq('check_status', 'ok')

  if (skipFatturaMancante) {
    query = query.neq('check_status', 'fattura_mancante')
  }

  const { data: rows, error: rowsError } = await query

  if (rowsError) {
    console.error('[statement-auto-resolve] join query failed:', rowsError.message)
  } else {
    for (const row of rows ?? []) {
      const stmt = parseStatementJoin(row.statements as Parameters<typeof parseStatementJoin>[0])
      if (stmt) byId.set(stmt.id, stmt)
    }
  }

  // Fallback: estratti con missing_rows > 0 ma conteggi non allineati
  if (byId.size === 0 && !skipFatturaMancante) {
    const { data: staleStmts } = await supabase
      .from('statements')
      .select('id, fornitore_id, sede_id')
      .eq('sede_id', sedeId)
      .gt('missing_rows', 0)

    for (const s of staleStmts ?? []) {
      byId.set(s.id, s)
    }
  }

  return [...byId.values()]
}

async function syncMissingRowsForSede(supabase: SupabaseClient, sedeId: string): Promise<void> {
  const statements = await loadStatementsForSede(supabase, sedeId)
  for (const stmt of statements) {
    const { count } = await supabase
      .from('statement_rows')
      .select('*', { count: 'exact', head: true })
      .eq('statement_id', stmt.id)
      .neq('check_status', 'ok')

    await supabase
      .from('statements')
      .update({ missing_rows: count ?? 0 })
      .eq('id', stmt.id)
  }
}

async function reprocessStatement(
  supabase: SupabaseClient,
  stmt: StatementRef,
): Promise<{ righe: number; ok: number; anomale: number; error?: string }> {
  const { data: rows } = await supabase
    .from('statement_rows')
    .select('id, numero_doc, importo, data_doc')
    .eq('statement_id', stmt.id)

  if (!rows?.length) {
    await supabase.from('statements').update({ total_rows: 0, missing_rows: 0 }).eq('id', stmt.id)
    return { righe: 0, ok: 0, anomale: 0, error: `Statement ${stmt.id}: nessuna riga` }
  }

  const lines: StatementLine[] = rows.map((r) => ({
    numero: r.numero_doc ?? '',
    importo: r.importo ?? 0,
    data: r.data_doc ?? null,
  }))

  const { results } = await runTripleCheck(supabase, lines, stmt.sede_id, stmt.fornitore_id)

  let ok = 0
  let anomale = 0

  for (const r of results) {
    const existingRow = rows.find((row) => row.numero_doc === r.numero)
    if (!existingRow) continue

    const bolle_json =
      r.bolle.length > 0
        ? r.bolle.map((b) => ({
            id: b.id,
            numero_bolla: b.numero_bolla,
            importo: b.importo,
            data: b.data,
          }))
        : null

    await supabase
      .from('statement_rows')
      .update({
        check_status: r.status,
        delta_importo: r.deltaImporto,
        fattura_id: r.fattura?.id ?? null,
        fattura_numero: r.fattura?.numero_fattura ?? null,
        fornitore_id: r.fornitore?.id ?? stmt.fornitore_id,
        bolle_json,
      })
      .eq('id', existingRow.id)

    if (r.status === 'ok') ok++
    else anomale++
  }

  const missingRows = results.filter((r) => r.status !== 'ok').length
  await supabase
    .from('statements')
    .update({ total_rows: results.length, missing_rows: missingRows })
    .eq('id', stmt.id)

  return { righe: results.length, ok, anomale }
}

async function recheckFalseErrorsForSede(
  supabase: SupabaseClient,
  sedeId: string,
): Promise<{ fixed: number; okCount: number }> {
  const { data: rows, error } = await supabase
    .from('statement_rows')
    .select('id, importo, fattura_id, bolle_json, check_status, statements!inner(sede_id)')
    .eq('statements.sede_id', sedeId)
    .eq('check_status', 'errore_importo')
    .not('fattura_id', 'is', null)

  if (error || !rows?.length) return { fixed: 0, okCount: 0 }

  let fixed = 0
  let okCount = 0

  for (const row of rows) {
    const bolleJson = Array.isArray(row.bolle_json) ? row.bolle_json : []
    const bolleSum = bolleJson.reduce((s: number, b: { importo?: number }) => s + (b.importo ?? 0), 0)
    const rowImporto = Number(row.importo)

    let newStatus: string
    if (bolleJson.length > 0 && !amountsMatchForTripleCheck(bolleSum, rowImporto, TRIPLE_CHECK_TOLERANCE)) {
      newStatus = 'bolle_mancanti'
    } else {
      newStatus = 'ok'
      okCount++
    }

    const { error: updErr } = await supabase
      .from('statement_rows')
      .update({ check_status: newStatus })
      .eq('id', row.id)

    if (!updErr) fixed++
  }

  return { fixed, okCount }
}

/**
 * Fast-path: mark as 'ok' all statement_rows that already have a matching
 * fattura (fattura_id IS NOT NULL) AND the amount is aligned (delta_importo = 0
 * or NULL). No triple-check re-run needed — the invoice is already linked.
 *
 * Covers:
 *   - bolle_mancanti  → fattura trovata, importo ok, DDT not required
 *   - errore_importo  → false alarm where delta is actually 0
 */
async function fastCloseResolvedRows(
  supabase: SupabaseClient,
  sedeId: string,
): Promise<number> {
  // Fetch all statement IDs for this sede
  const { data: stmts } = await supabase
    .from('statements')
    .select('id')
    .eq('sede_id', sedeId)

  const allIds = (stmts ?? []).map((s) => s.id as string)
  if (allIds.length === 0) return 0

  let totalFixed = 0

  for (let i = 0; i < allIds.length; i += IN_CHUNK) {
    const chunk = allIds.slice(i, i + IN_CHUNK)

    const { data: toFix } = await supabase
      .from('statement_rows')
      .select('id')
      .in('statement_id', chunk)
      .in('check_status', ['bolle_mancanti', 'errore_importo'])
      .not('fattura_id', 'is', null)
      .or('delta_importo.is.null,delta_importo.eq.0')

    if (!toFix?.length) continue

    const fixIds = toFix.map((r) => r.id as string)
    // Update in sub-chunks to stay within Supabase row limits
    for (let j = 0; j < fixIds.length; j += IN_CHUNK) {
      const sub = fixIds.slice(j, j + IN_CHUNK)
      const { error } = await supabase
        .from('statement_rows')
        .update({ check_status: 'ok' })
        .in('id', sub)
      if (!error) totalFixed += sub.length
    }
  }

  return totalFixed
}

/**
 * Rivaluta in bulk le righe estratto conto con triple-check aggiornato.
 *
 * Strategy:
 *   1. Fast-path: close rows that already have a fattura_id and delta=0 in a
 *      single DB update (no network round-trips per statement).
 *   2. Slow-path: re-run runTripleCheck only on statements that still have
 *      anomalous rows after the fast-path.
 *   3. Sync missing_rows counts.
 */
export async function autoRisolviStatementRows(
  supabase: SupabaseClient,
  sedeId: string,
  options?: { maxStatementsPerRound?: number; maxRounds?: number },
): Promise<AutoRisolviStatementResult> {
  const maxStatementsPerRound = options?.maxStatementsPerRound ?? 200
  const maxRounds = options?.maxRounds ?? 2
  const errors: string[] = []

  // ── Step 1: Fast-path ────────────────────────────────────────────────────
  const fastFixed = await fastCloseResolvedRows(supabase, sedeId)

  // ── Step 2: Slow-path (triple-check re-run for remaining anomalies) ──────
  let statementsProcessed = 0
  let righeRivalutate = 0
  let righeOk = fastFixed
  let rounds = 0

  for (let round = 0; round < maxRounds; round++) {
    rounds = round + 1
    // Skip fattura_mancante — can't be resolved without uploading invoices first
    const toProcess = (await loadStatementIdsWithAnomalies(supabase, sedeId, true)).slice(0, maxStatementsPerRound)
    if (toProcess.length === 0) break

    for (const stmt of toProcess) {
      const result = await reprocessStatement(supabase, stmt)
      if (result.error) errors.push(result.error)
      statementsProcessed++
      righeRivalutate += result.righe
      righeOk += result.ok
    }
  }

  // ── Step 3: False-error recheck (errore_importo with mismatched delta) ───
  const falseErrors = await recheckFalseErrorsForSede(supabase, sedeId)

  // ── Step 4: Sync missing_rows counts on all statements ───────────────────
  await syncMissingRowsForSede(supabase, sedeId)

  const righeAnomaleFinali = await countAnomalousStatementRows(supabase, sedeId)

  return {
    statementsProcessed,
    righeRivalutate,
    righeOk,
    fastFixed,
    righeAncoraAnomale: righeAnomaleFinali,
    falseErrorsFixed: falseErrors.fixed,
    falseErrorsOk: falseErrors.okCount,
    rounds,
    errors,
  }
}

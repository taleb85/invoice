import type { SupabaseClient } from '@supabase/supabase-js'
import { runTripleCheck, type StatementLine, TRIPLE_CHECK_TOLERANCE, amountsMatchForTripleCheck } from '@/lib/triple-check'

export type AutoRisolviStatementResult = {
  statementsProcessed: number
  righeRivalutate: number
  righeOk: number
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
): Promise<StatementRef[]> {
  const byId = new Map<string, StatementRef>()

  // 1) Righe con check_status != ok (fonte verità per la coda)
  const { data: rows, error: rowsError } = await supabase
    .from('statement_rows')
    .select('statement_id, statements!inner(id, fornitore_id, sede_id)')
    .eq('statements.sede_id', sedeId)
    .neq('check_status', 'ok')

  if (rowsError) {
    console.error('[statement-auto-resolve] join query failed:', rowsError.message)
  } else {
    for (const row of rows ?? []) {
      const stmt = parseStatementJoin(row.statements as Parameters<typeof parseStatementJoin>[0])
      if (stmt) byId.set(stmt.id, stmt)
    }
  }

  // 2) Fallback: estratti con missing_rows > 0 ma conteggi non allineati
  if (byId.size === 0) {
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
 * Rivaluta in bulk le righe estratto conto con triple-check aggiornato.
 * Le righe che diventano `ok` escono automaticamente da v_coda_unificata.
 */
export async function autoRisolviStatementRows(
  supabase: SupabaseClient,
  sedeId: string,
  options?: { maxStatementsPerRound?: number; maxRounds?: number },
): Promise<AutoRisolviStatementResult> {
  const maxStatementsPerRound = options?.maxStatementsPerRound ?? 500
  const maxRounds = options?.maxRounds ?? 5
  const errors: string[] = []

  let statementsProcessed = 0
  let righeRivalutate = 0
  let righeOk = 0
  let righeAncoraAnomale = 0
  let rounds = 0

  for (let round = 0; round < maxRounds; round++) {
    rounds = round + 1

    const toProcess = (await loadStatementIdsWithAnomalies(supabase, sedeId)).slice(0, maxStatementsPerRound)
    if (toProcess.length === 0) break

    for (const stmt of toProcess) {
      const result = await reprocessStatement(supabase, stmt)
      if (result.error) errors.push(result.error)
      statementsProcessed++
      righeRivalutate += result.righe
      righeOk += result.ok
      righeAncoraAnomale += result.anomale
    }
  }

  const falseErrors = await recheckFalseErrorsForSede(supabase, sedeId)
  await syncMissingRowsForSede(supabase, sedeId)

  const righeAnomaleFinali = await countAnomalousStatementRows(supabase, sedeId)

  return {
    statementsProcessed,
    righeRivalutate,
    righeOk,
    righeAncoraAnomale: righeAnomaleFinali,
    falseErrorsFixed: falseErrors.fixed,
    falseErrorsOk: falseErrors.okCount,
    rounds,
    errors,
  }
}

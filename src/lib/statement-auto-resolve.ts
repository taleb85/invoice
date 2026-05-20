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
  const statements = await loadStatementsForSede(supabase, sedeId)
  if (statements.length === 0) return []

  const ids = statements.map((s) => s.id)
  const { data: anomalousRows } = await supabase
    .from('statement_rows')
    .select('statement_id')
    .in('statement_id', ids)
    .neq('check_status', 'ok')

  const anomalousIds = new Set((anomalousRows ?? []).map((r) => r.statement_id as string))
  return statements.filter((s) => anomalousIds.has(s.id))
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
  const statements = await loadStatementsForSede(supabase, sedeId)
  const ids = statements.map((s) => s.id)
  if (ids.length === 0) return { fixed: 0, okCount: 0 }

  const { data: rows } = await supabase
    .from('statement_rows')
    .select('id, importo, fattura_id, bolle_json, check_status')
    .in('statement_id', ids)
    .eq('check_status', 'errore_importo')
    .not('fattura_id', 'is', null)

  if (!rows?.length) return { fixed: 0, okCount: 0 }

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

    const { error } = await supabase
      .from('statement_rows')
      .update({ check_status: newStatus })
      .eq('id', row.id)

    if (!error) fixed++
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
  const maxRounds = options?.maxRounds ?? 3
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

  return {
    statementsProcessed,
    righeRivalutate,
    righeOk,
    righeAncoraAnomale: Math.max(0, righeAncoraAnomale - falseErrors.okCount),
    falseErrorsFixed: falseErrors.fixed,
    falseErrorsOk: falseErrors.okCount,
    rounds,
    errors,
  }
}

import type { SupabaseClient } from '@supabase/supabase-js'

export const STATEMENT_ANOMALY_STATUSES = [
  'fattura_mancante',
  'bolle_mancanti',
  'errore_importo',
  'rekki_prezzo_discordanza',
] as const

export type StatementAnomalyStatus = (typeof STATEMENT_ANOMALY_STATUSES)[number]

/** Conteggio anomalie per tipologia (inbox estratti). */
export type StatementAnomalyCountByStatus = {
  check_status: StatementAnomalyStatus
  count: number
}

/** Ordine di visualizzazione (più urgenti prima). */
export const STATEMENT_ANOMALY_STATUS_ORDER: StatementAnomalyStatus[] = [
  'errore_importo',
  'fattura_mancante',
  'bolle_mancanti',
  'rekki_prezzo_discordanza',
]

type StmtRow = { id: string }

function countsMapToSortedArray(
  counts: Map<StatementAnomalyStatus, number>,
): StatementAnomalyCountByStatus[] {
  return STATEMENT_ANOMALY_STATUS_ORDER.filter((status) => (counts.get(status) ?? 0) > 0).map(
    (status) => ({ check_status: status, count: counts.get(status)! }),
  )
}

/**
 * Allega `anomaly_by_status` a ogni statement con `missing_rows > 0`.
 */
export async function attachStatementAnomalyPreviews<T extends StmtRow>(
  supabase: SupabaseClient,
  statements: T[],
): Promise<Array<T & { anomaly_by_status: StatementAnomalyCountByStatus[] }>> {
  const withIssues = statements.filter((s) => {
    const missing = (s as T & { missing_rows?: number }).missing_rows
    return typeof missing === 'number' && missing > 0
  })
  if (withIssues.length === 0) {
    return statements.map((s) => ({ ...s, anomaly_by_status: [] }))
  }

  const ids = withIssues.map((s) => s.id)
  const { data: rows } = await supabase
    .from('statement_rows')
    .select('statement_id, check_status')
    .in('statement_id', ids)
    .in('check_status', [...STATEMENT_ANOMALY_STATUSES])

  const byStmt = new Map<string, Map<StatementAnomalyStatus, number>>()
  for (const row of rows ?? []) {
    const sid = row.statement_id as string
    const status = row.check_status as string
    if (!STATEMENT_ANOMALY_STATUSES.includes(status as StatementAnomalyStatus)) continue
    const counts = byStmt.get(sid) ?? new Map<StatementAnomalyStatus, number>()
    const key = status as StatementAnomalyStatus
    counts.set(key, (counts.get(key) ?? 0) + 1)
    byStmt.set(sid, counts)
  }

  return statements.map((s) => ({
    ...s,
    anomaly_by_status: countsMapToSortedArray(byStmt.get(s.id) ?? new Map()),
  }))
}

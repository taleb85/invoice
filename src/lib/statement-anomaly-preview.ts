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

const CREDIT_NOTE_PREFIX = /^(?:SCN|CN[\s-]|NC[\s-]|CRN[\s-]|CR[\s-]|RTN|RET)/i

/** Per le note di credito, bolle_mancanti ed errore_importo contano come ok. */
function effectiveStatus(checkStatus: string, numeroDoc: string | null): string {
  if (
    numeroDoc &&
    CREDIT_NOTE_PREFIX.test(numeroDoc) &&
    (checkStatus === 'bolle_mancanti' || checkStatus === 'errore_importo')
  ) {
    return 'ok'
  }
  return checkStatus
}

function countsMapToSortedArray(
  counts: Map<StatementAnomalyStatus, number>,
): StatementAnomalyCountByStatus[] {
  return STATEMENT_ANOMALY_STATUS_ORDER.filter((status) => (counts.get(status) ?? 0) > 0).map(
    (status) => ({ check_status: status, count: counts.get(status)! }),
  )
}

/**
 * Allega `anomaly_by_status` a ogni statement con `missing_rows > 0`.
 * Le note di credito con `errore_importo`/`bolle_mancanti` vengono conteggiate come `ok`.
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
    .select('statement_id, check_status, numero_doc')
    .in('statement_id', ids)
    .in('check_status', [...STATEMENT_ANOMALY_STATUSES])

  const byStmt = new Map<string, Map<StatementAnomalyStatus, number>>()
  for (const row of rows ?? []) {
    const sid = row.statement_id as string
    const rawStatus = row.check_status as string
    const numeroDoc = row.numero_doc as string | null
    const resolvedStatus = effectiveStatus(rawStatus, numeroDoc)
    if (!STATEMENT_ANOMALY_STATUSES.includes(resolvedStatus as StatementAnomalyStatus)) continue
    const counts = byStmt.get(sid) ?? new Map<StatementAnomalyStatus, number>()
    const key = resolvedStatus as StatementAnomalyStatus
    counts.set(key, (counts.get(key) ?? 0) + 1)
    byStmt.set(sid, counts)
  }

  return statements.map((s) => ({
    ...s,
    anomaly_by_status: countsMapToSortedArray(byStmt.get(s.id) ?? new Map()),
  }))
}

/** Conteggi per tipologia per un insieme di statement (batch API / fallback client). */
export async function fetchAnomalyByStatusMap(
  supabase: SupabaseClient,
  statementIds: string[],
): Promise<Record<string, StatementAnomalyCountByStatus[]>> {
  const ids = [...new Set(statementIds.filter(Boolean))].slice(0, 500)
  if (ids.length === 0) return {}

  const { data: rows } = await supabase
    .from('statement_rows')
    .select('statement_id, check_status, numero_doc')
    .in('statement_id', ids)
    .in('check_status', [...STATEMENT_ANOMALY_STATUSES])

  const byStmt = new Map<string, Map<StatementAnomalyStatus, number>>()
  for (const row of rows ?? []) {
    const sid = row.statement_id as string
    const rawStatus = row.check_status as string
    const numeroDoc = row.numero_doc as string | null
    const resolvedStatus = effectiveStatus(rawStatus, numeroDoc)
    if (!STATEMENT_ANOMALY_STATUSES.includes(resolvedStatus as StatementAnomalyStatus)) continue
    const counts = byStmt.get(sid) ?? new Map<StatementAnomalyStatus, number>()
    const key = resolvedStatus as StatementAnomalyStatus
    counts.set(key, (counts.get(key) ?? 0) + 1)
    byStmt.set(sid, counts)
  }

  const out: Record<string, StatementAnomalyCountByStatus[]> = {}
  for (const id of ids) {
    out[id] = countsMapToSortedArray(byStmt.get(id) ?? new Map())
  }
  return out
}

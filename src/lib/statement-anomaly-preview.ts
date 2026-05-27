import type { SupabaseClient } from '@supabase/supabase-js'

export const STATEMENT_ANOMALY_STATUSES = [
  'fattura_mancante',
  'bolle_mancanti',
  'errore_importo',
  'rekki_prezzo_discordanza',
] as const

export type StatementAnomalyStatus = (typeof STATEMENT_ANOMALY_STATUSES)[number]

export type StatementAnomalyPreviewItem = {
  numero_doc: string
  check_status: StatementAnomalyStatus
}

/** Max righe mostrate in inbox estratti (scheda fornitore / lista statement). */
export const STATEMENT_ANOMALY_PREVIEW_LIMIT = 6

type StmtRow = { id: string }

/**
 * Allega `anomaly_preview` a ogni statement con `missing_rows > 0`.
 */
export async function attachStatementAnomalyPreviews<T extends StmtRow>(
  supabase: SupabaseClient,
  statements: T[],
  previewLimit = STATEMENT_ANOMALY_PREVIEW_LIMIT,
): Promise<Array<T & { anomaly_preview: StatementAnomalyPreviewItem[] }>> {
  const withIssues = statements.filter((s) => {
    const missing = (s as T & { missing_rows?: number }).missing_rows
    return typeof missing === 'number' && missing > 0
  })
  if (withIssues.length === 0) {
    return statements.map((s) => ({ ...s, anomaly_preview: [] }))
  }

  const ids = withIssues.map((s) => s.id)
  const { data: rows } = await supabase
    .from('statement_rows')
    .select('statement_id, numero_doc, check_status')
    .in('statement_id', ids)
    .in('check_status', [...STATEMENT_ANOMALY_STATUSES])
    .order('numero_doc', { ascending: true })

  const byStmt = new Map<string, StatementAnomalyPreviewItem[]>()
  for (const row of rows ?? []) {
    const sid = row.statement_id as string
    const status = row.check_status as string
    if (!STATEMENT_ANOMALY_STATUSES.includes(status as StatementAnomalyStatus)) continue
    const numero = String(row.numero_doc ?? '').trim() || '—'
    const list = byStmt.get(sid) ?? []
    list.push({ numero_doc: numero, check_status: status as StatementAnomalyStatus })
    byStmt.set(sid, list)
  }

  return statements.map((s) => ({
    ...s,
    anomaly_preview: (byStmt.get(s.id) ?? []).slice(0, previewLimit),
  }))
}

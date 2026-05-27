import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeStatementFileUrl } from '@/lib/statement-list-dedup'

export type PendingStatementDocRow = {
  id: string
  file_url: string | null
  fornitore_id: string | null
  sede_id: string | null
  data_documento: string | null
  is_statement: boolean | null
  stato: string
}

const PENDING_STATEMENT_STATI = ['da_processare', 'da_associare', 'da_revisionare', 'in_attesa'] as const

/**
 * Sgancia dalla coda i documenti statement già presenti in `statements`
 * (stesso file_url o stesso fornitore + data documento — tipico G Lawrence).
 */
export async function cleanupPendingStatementDuplicates(
  supabase: SupabaseClient,
  opts: { sedeId?: string | null; fornitoreId?: string | null },
): Promise<{ marked: number; doc_ids: string[] }> {
  const sedeId = opts.sedeId?.trim() || null
  const fornitoreId = opts.fornitoreId?.trim() || null
  if (!sedeId && !fornitoreId) return { marked: 0, doc_ids: [] }

  let stmtQuery = supabase
    .from('statements')
    .select('file_url, fornitore_id, document_date, status, total_rows')
    .limit(5000)

  if (sedeId) stmtQuery = stmtQuery.eq('sede_id', sedeId)
  if (fornitoreId) stmtQuery = stmtQuery.eq('fornitore_id', fornitoreId)

  const { data: stmtRows, error: stmtErr } = await stmtQuery
  if (stmtErr || !stmtRows?.length) return { marked: 0, doc_ids: [] }

  const existingFileUrls = new Set<string>()
  const existingPeriodKeys = new Set<string>()

  for (const s of stmtRows) {
    const url = normalizeStatementFileUrl(s.file_url as string | null)
    if (url) existingFileUrls.add(url)
    const fid = s.fornitore_id as string | null
    const docDate = s.document_date as string | null
    const done =
      s.status === 'done' ||
      (typeof s.total_rows === 'number' && s.total_rows > 0)
    if (fid && docDate && done) {
      existingPeriodKeys.add(`${fid}|${docDate}`)
    }
  }

  let docQuery = supabase
    .from('documenti_da_processare')
    .select('id, file_url, fornitore_id, sede_id, data_documento, is_statement, stato')
    .eq('is_statement', true)
    .in('stato', [...PENDING_STATEMENT_STATI])
    .limit(2000)

  if (sedeId) docQuery = docQuery.eq('sede_id', sedeId)
  if (fornitoreId) docQuery = docQuery.eq('fornitore_id', fornitoreId)

  const { data: docs, error: docErr } = await docQuery
  if (docErr || !docs?.length) return { marked: 0, doc_ids: [] }

  const toMark: string[] = []
  for (const d of docs as PendingStatementDocRow[]) {
    const url = normalizeStatementFileUrl(d.file_url)
    if (url && existingFileUrls.has(url)) {
      toMark.push(d.id)
      continue
    }
    if (d.fornitore_id && d.data_documento) {
      const periodKey = `${d.fornitore_id}|${d.data_documento}`
      if (existingPeriodKeys.has(periodKey)) {
        toMark.push(d.id)
      }
    }
  }

  const uniqueIds = [...new Set(toMark)]
  if (!uniqueIds.length) return { marked: 0, doc_ids: [] }

  const { error: updErr } = await supabase
    .from('documenti_da_processare')
    .update({ is_statement: false, stato: 'associato' })
    .in('id', uniqueIds)

  if (updErr) return { marked: 0, doc_ids: [] }
  return { marked: uniqueIds.length, doc_ids: uniqueIds }
}

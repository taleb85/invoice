import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeSenderEmailCanonical } from '@/lib/sender-email'
import { resolveFornitoreFromScanEmail } from '@/lib/fornitore-resolve-scan-email'
import { processLegacyPendingDoc, type LegacyPendingDocRow } from '@/lib/reprocess-pending-docs-ocr'

export type RetroactiveCleanupResult = {
  processed: number
  errors: string[]
  scanned: number
}

const DEFAULT_MAX = 80

async function fetchRevisioneCandidates(
  service: SupabaseClient,
  sedeFilter: string | null,
  limit: number,
): Promise<LegacyPendingDocRow[]> {
  let q = service
    .from('documenti_da_processare')
    .select('id,file_url,file_name,content_type,fornitore_id,sede_id,oggetto_mail,mittente,metadata,note,is_statement')
    .eq('stato', 'da_revisionare')
    .is('fornitore_id', null)
    .not('mittente', 'is', null)
    .limit(limit)
  if (sedeFilter) q = q.eq('sede_id', sedeFilter)
  q = q.order('created_at', { ascending: true })
  const { data, error } = await q
  if (error) {
    console.warn('[revisione-auto] fetch candidates', error.message)
    return []
  }
  return (data ?? []) as LegacyPendingDocRow[]
}

/** Quando ora esiste alias / email primaria → riprocessa con la stessa pipeline OCR degli scan. */
async function attemptProcessRow(
  service: SupabaseClient,
  row: LegacyPendingDocRow,
): Promise<boolean> {
  const emailNorm = normalizeSenderEmailCanonical(row.mittente)
  if (!emailNorm?.includes('@')) return false

  const sedeFilter = row.sede_id ?? null
  const fornitore = await resolveFornitoreFromScanEmail(service, emailNorm, sedeFilter)
  if (!fornitore?.id) return false

  const merged: LegacyPendingDocRow = {
    ...row,
    fornitore_id: fornitore.id,
  }
  const r = await processLegacyPendingDoc(service, merged)
  if (r.status === 'error') {
    console.warn('[revisione-auto] process doc', row.id, r.message)
    return false
  }
  return r.category === 'auto_saved'
}

/** Passata prima di IMAP: documenti ora abbinabili perché è stato registrato mittente nell’anagrafica. */
export async function retroactiveCleanupDaRevisionare(
  service: SupabaseClient,
  opts: { sedeId: string | null; maxRows?: number },
): Promise<RetroactiveCleanupResult> {
  const limit = opts.maxRows ?? DEFAULT_MAX
  const rows = await fetchRevisioneCandidates(service, opts.sedeId, limit)
  const errors: string[] = []
  let processed = 0

  for (const row of rows) {
    const emailNorm = normalizeSenderEmailCanonical(row.mittente)
    if (!emailNorm?.includes('@')) continue
    const fornitore = await resolveFornitoreFromScanEmail(service, emailNorm, row.sede_id ?? null)
    if (!fornitore?.id) continue
    try {
      const merged: LegacyPendingDocRow = { ...row, fornitore_id: fornitore.id }
      const r = await processLegacyPendingDoc(service, merged)
      if (r.status === 'error') {
        errors.push(`${row.id}: ${r.message}`)
        continue
      }
      if (r.category === 'auto_saved') processed++
    } catch (e) {
      errors.push(`${row.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { processed, errors, scanned: rows.length }
}

/** POST fornitori / fornitore-emails dopo aver registrato mittente nell’anagrafica. */
export async function autoProcessAfterFornitoreEmailAdded(
  service: SupabaseClient,
  fornitoreId: string,
  emailNormalized: string,
): Promise<RetroactiveCleanupResult> {
  const em = emailNormalized.trim().toLowerCase()
  if (!em.includes('@')) return { processed: 0, errors: [], scanned: 0 }

  const { data: f, error: fe } = await service
    .from('fornitori')
    .select('id, sede_id')
    .eq('id', fornitoreId)
    .maybeSingle()
  if (fe || !f) return { processed: 0, errors: [], scanned: 0 }

  let q = service
    .from('documenti_da_processare')
    .select('id,file_url,file_name,content_type,fornitore_id,sede_id,oggetto_mail,mittente,metadata,note,is_statement')
    .eq('stato', 'da_revisionare')
    .is('fornitore_id', null)

  const sede = (f as { sede_id?: string | null }).sede_id
  if (sede) q = q.eq('sede_id', sede)

  const { data: rows, error: re } = await q.limit(250)
  if (re || !rows?.length) return { processed: 0, errors: [], scanned: 0 }

  const errors: string[] = []
  let processed = 0
  let scanned = 0

  for (const raw of rows) {
    const row = raw as LegacyPendingDocRow
    const cand = normalizeSenderEmailCanonical(row.mittente)
    scanned++
    if (cand !== em) continue
    try {
      const merged: LegacyPendingDocRow = { ...row, fornitore_id: fornitoreId }
      const r = await processLegacyPendingDoc(service, merged)
      if (r.status === 'error') {
        errors.push(`${row.id}: ${r.message}`)
        continue
      }
      if (r.category === 'auto_saved') processed++
    } catch (e) {
      errors.push(`${row.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { processed, errors, scanned }
}

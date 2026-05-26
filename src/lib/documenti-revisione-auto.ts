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

export type RealignStatementsResult = {
  /** Numero di righe `documenti_da_processare` con fornitore_id corretto (re-bind a fornitoreId). */
  documentsRebound: number
  /** Numero di righe `statements` riassegnate al fornitore corretto. */
  statementsRebound: number
  /** Numero di `statement_rows` ripulite (fattura_id/bolle_json/check_status). */
  statementRowsReset: number
  errors: string[]
}

/**
 * Quando un mittente email viene linkato (o re-linkato) a un fornitore, riallinea i dati storici:
 *
 *  1. `documenti_da_processare`: ogni riga con quel mittente, nella stessa sede del fornitore,
 *     che ha `fornitore_id` diverso dal nuovo valore → re-bound al `fornitoreId` corretto.
 *  2. `statements`: ogni riga il cui `file_url` corrisponde ad uno dei documenti re-bound
 *     (match normalizzato per rimuovere `\n` parassiti già visti nello storico) e che ha
 *     `fornitore_id` diverso dal nuovo valore → riassegnata.
 *  3. `statement_rows` collegate: `fornitore_id` aggiornato al nuovo fornitore, `fattura_id`,
 *     `fattura_numero`, `bolle_json`, `delta_importo` ripuliti, `check_status='pending'`.
 *  4. Gli statement riassegnati passano a `status='processing'` così la UI rilancia
 *     automaticamente la triple-check al primo accesso (`loadStatementRows()` → `?action=recheck`).
 *
 * Non tocca statement il cui mittente del documento sorgente non corrisponde all'email linkata —
 * evita di sovrascrivere assegnazioni manuali volute.
 *
 * Best-effort: errori per singolo statement non bloccano gli altri (raccolti in `errors`).
 */
export async function realignStatementsAfterFornitoreEmailAdded(
  service: SupabaseClient,
  fornitoreId: string,
  emailNormalized: string,
): Promise<RealignStatementsResult> {
  const empty: RealignStatementsResult = {
    documentsRebound: 0,
    statementsRebound: 0,
    statementRowsReset: 0,
    errors: [],
  }
  const em = emailNormalized.trim().toLowerCase()
  if (!em.includes('@')) return empty

  const { data: f, error: fe } = await service
    .from('fornitori')
    .select('id, sede_id')
    .eq('id', fornitoreId)
    .maybeSingle()
  if (fe || !f) return empty

  const sede = (f as { sede_id?: string | null }).sede_id ?? null

  // ── 1. Trova documenti con quel mittente la cui assegnazione non coincide col nuovo fornitore.
  let docsQ = service
    .from('documenti_da_processare')
    .select('id, file_url, fornitore_id, mittente, sede_id, is_statement')
    .not('mittente', 'is', null)
    .neq('fornitore_id', fornitoreId)
  if (sede) docsQ = docsQ.eq('sede_id', sede)
  const { data: docsRaw, error: docsErr } = await docsQ.limit(500)
  if (docsErr) {
    empty.errors.push(`fetch documenti: ${docsErr.message}`)
    return empty
  }

  type DocRow = {
    id: string
    file_url: string | null
    fornitore_id: string | null
    mittente: string | null
    sede_id: string | null
    is_statement: boolean | null
  }
  const docs = ((docsRaw ?? []) as DocRow[]).filter(
    (d) => normalizeSenderEmailCanonical(d.mittente) === em,
  )
  if (!docs.length) return empty

  // ── 2. Re-bind `documenti_da_processare` al fornitore corretto.
  const docIds = docs.map((d) => d.id)
  const { error: updDocsErr } = await service
    .from('documenti_da_processare')
    .update({ fornitore_id: fornitoreId })
    .in('id', docIds)
  if (updDocsErr) {
    empty.errors.push(`update documenti: ${updDocsErr.message}`)
    return empty
  }
  empty.documentsRebound = docs.length

  // ── 3. Statements drift: file_url match (con tolleranza al `\n` parassita) e fornitore diverso.
  const fileUrls = [...new Set(docs.map((d) => d.file_url?.trim()).filter((u): u is string => !!u))]
  if (!fileUrls.length) return empty

  // Considera anche le varianti con \n inserito a metà host (es. "supabase.co\n/storage/…").
  const fileUrlVariants = new Set<string>()
  for (const u of fileUrls) {
    fileUrlVariants.add(u)
    fileUrlVariants.add(u.replace('supabase.co/storage', 'supabase.co\n/storage'))
  }

  const { data: stmtsRaw, error: stmtsErr } = await service
    .from('statements')
    .select('id, file_url, fornitore_id')
    .in('file_url', [...fileUrlVariants])
    .neq('fornitore_id', fornitoreId)
  if (stmtsErr) {
    empty.errors.push(`fetch statements: ${stmtsErr.message}`)
    return empty
  }
  type StmtRow = { id: string; file_url: string | null; fornitore_id: string | null }
  const stmts = (stmtsRaw ?? []) as StmtRow[]
  if (!stmts.length) return empty

  const stmtIds = stmts.map((s) => s.id)

  // ── 4. Reset righe.
  const { count: rowsCount, error: updRowsErr } = await service
    .from('statement_rows')
    .update(
      {
        fornitore_id: fornitoreId,
        fattura_id: null,
        fattura_numero: null,
        bolle_json: null,
        delta_importo: null,
        check_status: 'pending',
      },
      { count: 'exact' },
    )
    .in('statement_id', stmtIds)
  if (updRowsErr) {
    empty.errors.push(`update statement_rows: ${updRowsErr.message}`)
  } else {
    empty.statementRowsReset = rowsCount ?? 0
  }

  // ── 5. Riassegna gli statement al nuovo fornitore e marca processing per triggerare il recheck.
  const { error: updStmtsErr } = await service
    .from('statements')
    .update({ fornitore_id: fornitoreId, status: 'processing', missing_rows: 0 })
    .in('id', stmtIds)
  if (updStmtsErr) {
    empty.errors.push(`update statements: ${updStmtsErr.message}`)
    return empty
  }
  empty.statementsRebound = stmts.length

  return empty
}

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { findStatementRowByNumeroDoc } from '@/lib/fattura-duplicate-check'
import { runTripleCheck, type StatementLine } from '@/lib/triple-check'
import { logActivity, ACTIVITY_ACTIONS } from '@/lib/activity-logger'
import { logger } from '@/lib/logger'

/**
 * POST /api/reprocess-statement-checks
 *
 * Rilegge tutti gli statement con anomalie (missing_rows > 0) per la sede data
 * e ri-esegue il triple-check con la logica aggiornata (match anche su bolle).
 *
 * Body:
 *   sede_id         — branch (obbligatorio)
 *   fornitore_id    — opzionale, limita al fornitore
 *   statement_ids   — opzionale, riprocessa solo questi (es. lista UI fornitore)
 *   limit           — max statements da riprocessare (default 100)
 */
export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const body = await req.json().catch(() => ({})) as {
    sede_id?: string
    fornitore_id?: string
    statement_ids?: string[]
    limit?: number
  }
  const { sede_id, fornitore_id } = body
  const statementIds = Array.isArray(body.statement_ids)
    ? [...new Set(body.statement_ids.filter((id): id is string => typeof id === 'string' && id.length > 0))].slice(0, 500)
    : []
  const limit = Math.min(body.limit ?? (statementIds.length > 0 ? statementIds.length : 100), 500)

  if (!sede_id) {
    return NextResponse.json({ error: 'sede_id obbligatorio' }, { status: 400 })
  }

  const emetteBolleCache = new Map<string, boolean>()

  async function supplierEmitsBolle(fornId: string | null): Promise<boolean> {
    if (!fornId) return true
    const cached = emetteBolleCache.get(fornId)
    if (cached !== undefined) return cached
    const { data } = await supabase
      .from('fornitori')
      .select('emette_bolle')
      .eq('id', fornId)
      .maybeSingle()
    const emits = !(data && (data as { emette_bolle?: boolean | null }).emette_bolle === false)
    emetteBolleCache.set(fornId, emits)
    return emits
  }

  // ── Trova statement da riprocessare ───────────────────────────────────
  let stmtQ = supabase
    .from('statements')
    .select('id, fornitore_id, sede_id')
    .eq('sede_id', sede_id)

  if (fornitore_id) stmtQ = stmtQ.eq('fornitore_id', fornitore_id)

  if (statementIds.length > 0) {
    stmtQ = stmtQ.in('id', statementIds).eq('status', 'done')
  } else {
    stmtQ = stmtQ.gt('missing_rows', 0)
  }

  const { data: statements } = await stmtQ
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!statements?.length) {
    return NextResponse.json({ processed: 0, errors: [], message: 'Nessuno statement con anomalie da riprocessare.' })
  }

  const stmtIds = statements.map(s => s.id)
  const errors: string[] = []
  let processed = 0
  let righeRivalutate = 0

  for (const stmt of statements) {
    // ── Carica le righe esistenti ──────────────────────────────────────
    const { data: rows } = await supabase
      .from('statement_rows')
      .select('id, numero_doc, importo, data_doc')
      .eq('statement_id', stmt.id)

    if (!rows?.length) {
      errors.push(`Statement ${stmt.id}: nessuna riga trovata`)
      continue
    }

    // ── Prepara le linee per il triple-check ────────────────────────────
    const lines: StatementLine[] = rows.map(r => ({
      numero: r.numero_doc ?? '',
      importo: r.importo ?? 0,
      data: r.data_doc ?? null,
    }))

    // ── Esegui triple-check aggiornato ──────────────────────────────────
    const { results: rawResults } = await runTripleCheck(supabase, lines, stmt.sede_id, stmt.fornitore_id)
    const emetteBolle = await supplierEmitsBolle(stmt.fornitore_id)
    const results = emetteBolle
      ? rawResults.map((r) =>
          r.status === 'ok' && r.bolle.length === 0 ? { ...r, status: 'bolle_mancanti' as const } : r,
        )
      : rawResults

    // ── Aggiorna ogni riga ──────────────────────────────────────────────
    for (const r of results) {
      const existingRow = findStatementRowByNumeroDoc(rows, r.numero)
      if (!existingRow) continue

      const bolle_json = r.bolle.length > 0 ? r.bolle.map(b => ({
        id: b.id,
        numero_bolla: b.numero_bolla,
        importo: b.importo,
        data: b.data,
      })) : null

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
    }

    // ── Aggiorna conteggi riepilogativi ─────────────────────────────────
    const missingRows = results.filter(r => r.status !== 'ok').length
    await supabase.from('statements').update({
      total_rows: results.length,
      missing_rows: missingRows,
    }).eq('id', stmt.id)

    processed++
    righeRivalutate += results.length
  }

  await logActivity(supabase, {
    userId: user.id,
    sedeId: null,
    action: ACTIVITY_ACTIONS.DOCUMENTO_PROCESSED,
    entityType: 'statement',
    metadata: {
      recheck: true,
      processed,
      statements: stmtIds.length,
      errors: errors.length,
    },
  })

  return NextResponse.json({
    processed,
    righe_rivalutate: righeRivalutate,
    errors,
    message: `Riprocessati ${processed} statement (${righeRivalutate} righe) con triple-check aggiornato.`,
  })
}

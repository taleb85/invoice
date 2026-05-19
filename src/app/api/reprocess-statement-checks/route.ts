import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
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
 *   sede_id — branch (obbligatorio)
 *   limit   — max statements da riprocessare (default 100)
 */
export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const body = await req.json().catch(() => ({})) as { sede_id?: string; limit?: number }
  const { sede_id } = body
  const limit = Math.min(body.limit ?? 100, 500)

  if (!sede_id) {
    return NextResponse.json({ error: 'sede_id obbligatorio' }, { status: 400 })
  }

  // ── Trova statement con anomalie ──────────────────────────────────────
  const { data: statements } = await supabase
    .from('statements')
    .select('id, fornitore_id, sede_id')
    .eq('sede_id', sede_id)
    .gt('missing_rows', 0)
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
    const { results } = await runTripleCheck(supabase, lines, stmt.sede_id, stmt.fornitore_id)

    // ── Aggiorna ogni riga ──────────────────────────────────────────────
    for (const r of results) {
      const existingRow = rows.find(row => row.numero_doc === r.numero)
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

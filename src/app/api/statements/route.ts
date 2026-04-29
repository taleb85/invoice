/**
 * GET  /api/statements?sede_id=xxx           — list all statements for a branch
 * GET  /api/statements?sede_id=xxx&id=yyy    — get rows for a specific statement
 * POST /api/statements/[id]/recheck          — (handled inline below via ?action=recheck&id=yyy)
 *
 * The `statements` and `statement_rows` tables are created by the SQL migration
 * in supabase/migrations/add-statements.sql.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import { runTripleCheck } from '@/lib/triple-check'

export async function GET(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const sedeId      = searchParams.get('sede_id')
  const fornitoreId = searchParams.get('fornitore_id')
  const statementId = searchParams.get('id')
  const action      = searchParams.get('action')
  const listLimit   = fornitoreId ? 500 : 200

  // ── Get rows for one statement ──────────────────────────────────────────
  if (statementId && action !== 'recheck') {
    const { data: rows, error } = await supabase
      .from('statement_rows')
      .select('id, numero_doc, importo, data_doc, check_status, delta_importo, fattura_id, fattura_numero, bolle_json, fornitore_id')
      .eq('statement_id', statementId)
      .order('data_doc', { ascending: true, nullsFirst: true })
      .order('numero_doc', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Resolve fornitore names separately to avoid FK join cache issues
    const fIds = [...new Set((rows ?? []).map((r: { fornitore_id: string | null }) => r.fornitore_id).filter(Boolean))]
    const fMap: Record<string, { id: string; nome: string; email: string | null }> = {}
    if (fIds.length) {
      const { data: fRows } = await supabase.from('fornitori').select('id, nome, email').in('id', fIds)
      for (const f of fRows ?? []) fMap[f.id] = f
    }

    const enriched = (rows ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      fornitori: fMap[(r.fornitore_id as string) ?? ''] ?? null,
    }))

    return NextResponse.json(enriched)
  }

  // ── Recheck: re-run triple-check on a statement's rows ─────────────────
  if (statementId && action === 'recheck') {
    const { data: stmt } = await supabase
      .from('statements')
      .select('id, sede_id, fornitore_id')
      .eq('id', statementId)
      .single()

    if (!stmt) return NextResponse.json({ error: 'Statement non trovato' }, { status: 404 })

    const { data: existingRows } = await supabase
      .from('statement_rows')
      .select('numero_doc, importo')
      .eq('statement_id', statementId)

    if (!existingRows?.length) return NextResponse.json({ ok: true, rechecked: 0 })

    const lines = existingRows.map(r => ({ numero: r.numero_doc, importo: Number(r.importo) }))
    const { results } = await runTripleCheck(supabase, lines, stmt.sede_id, stmt.fornitore_id)

    // Single upsert replaces R sequential UPDATE calls (N+1 pattern).
    // Conflict target: the (statement_id, numero_doc) unique constraint on statement_rows.
    await supabase.from('statement_rows').upsert(
      results.map((r) => ({
        statement_id:   statementId,
        numero_doc:     r.numero,
        check_status:   r.status,
        delta_importo:  r.deltaImporto,
        fattura_id:     r.fattura?.id ?? null,
        fattura_numero: r.fattura?.numero_fattura ?? null,
        fornitore_id:   r.fornitore?.id ?? null,
        bolle_json:     r.bolle.length ? r.bolle : null,
      })),
      { onConflict: 'statement_id,numero_doc' },
    )

    const missingRows = results.filter(r => r.status !== 'ok').length
    await supabase.from('statements').update({
      status:       'done',
      missing_rows: missingRows,
    }).eq('id', statementId)

    return NextResponse.json({ ok: true, rechecked: results.length, missing_rows: missingRows })
  }

  // ── List statements for a sede ─────────────────────────────────────────
  // Avoid FK join (fornitori) to sidestep PostgREST schema-cache issues on
  // freshly-created tables. We resolve the supplier name in a second query.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from('statements')
    .select(
      [
        'id',
        'sede_id',
        'fornitore_id',
        'file_url',
        'document_date',
        'periodo',
        'totale_outstanding',
        'created_at',
        'email_reference_id',
        'email_subject',
        'received_at',
        'status',
        'total_rows',
        'missing_rows',
      ].join(', '),
    )
    .order('received_at', { ascending: false })
    /* Per singolo fornitore servono più righe (estratto 2025 vs ricezioni 2026, cronologia lunga). */
    .limit(listLimit)

  if (sedeId)      q = q.eq('sede_id',      sedeId)
  if (fornitoreId) q = q.eq('fornitore_id', fornitoreId)

  const { data, error } = await q
  if (error) {
    // Table does not exist yet (before migration) — only match this exact code
    if (error.code === '42P01') {
      return NextResponse.json({ statements: [], needsMigration: true })
    }
    console.error('[GET /api/statements]', error.code, error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Resolve supplier names in a separate query (avoids FK join issues)
  type StmtRow = { fornitore_id: string | null }
  const fornitoreIds: string[] = [...new Set(
    (data as StmtRow[]).map(s => s.fornitore_id).filter((id): id is string => !!id)
  )]
  const nomeMap: Record<string, string> = {}
  if (fornitoreIds.length) {
    const { data: fRows } = await supabase
      .from('fornitori').select('id, nome').in('id', fornitoreIds)
    for (const f of (fRows ?? []) as { id: string; nome: string }[]) nomeMap[f.id] = f.nome
  }

  const statements = (data ?? []).map((s: Record<string, unknown>) => ({
    ...s,
    fornitore_nome: nomeMap[(s.fornitore_id as string) ?? ''] ?? null,
  }))

  const hasMissing = statements.some((s: { missing_rows?: number }) => (s.missing_rows ?? 0) > 0)
  return NextResponse.json({ statements, hasMissing })
}

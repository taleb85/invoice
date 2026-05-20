/**
 * GET /api/statements/recent?sede_id=xxx
 *
 * Returns summary stats and recent statements for the centro-controllo dashboard.
 * - total:          number of statements for this sede
 * - con_anomalie:   statements with missing_rows > 0
 * - anomalie_totali: sum of missing_rows across all statements
 * - recenti:        last 20 statements with fornitore name
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { countAnomalousStatementRows } from '@/lib/statement-auto-resolve'

export async function GET(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const sedeId = searchParams.get('sede_id')

  if (!sedeId) {
    return NextResponse.json({ error: 'sede_id obbligatorio' }, { status: 400 })
  }

  const { data: stats } = await supabase
    .from('statements')
    .select('id, file_url, email_subject, received_at, status, total_rows, missing_rows, created_at, fornitore_id', { count: 'exact' })
    .eq('sede_id', sedeId)
    .order('created_at', { ascending: false })

  if (!stats) {
    return NextResponse.json({ total: 0, con_anomalie: 0, anomalie_totali: 0, recenti: [] })
  }

  const total = stats.length
  const conAnomalie = stats.filter(s => (s.missing_rows ?? 0) > 0).length
  const anomalieTotali = stats.reduce((acc, s) => acc + (s.missing_rows ?? 0), 0)

  // Resolve fornitore names
  const fornitoreIds = [...new Set(stats.map(s => s.fornitore_id).filter(Boolean) as string[])]
  const fornitoreMap: Record<string, string> = {}
  if (fornitoreIds.length > 0) {
    const { data: fornitori } = await supabase
      .from('fornitori')
      .select('id, nome')
      .in('id', fornitoreIds)
    for (const f of fornitori ?? []) fornitoreMap[f.id] = f.nome
  }

  const recenti = stats.slice(0, 20).map(s => ({
    id: s.id,
    file_url: s.file_url,
    email_subject: s.email_subject,
    received_at: s.received_at,
    status: s.status,
    total_rows: s.total_rows ?? 0,
    missing_rows: s.missing_rows ?? 0,
    created_at: s.created_at,
    fornitore_nome: s.fornitore_id ? (fornitoreMap[s.fornitore_id] ?? null) : null,
  }))

  // Check how many pending statements are still to be processed
  const { data: pendingDocs } = await supabase
    .from('documenti_da_processare')
    .select('id, file_url, file_name, oggetto_mail, fornitore_id, created_at')
    .eq('is_statement', true)
    .eq('sede_id', sedeId)
    .order('created_at', { ascending: false })

  const pendingFileUrls = [...new Set((pendingDocs ?? []).map(d => d.file_url).filter(Boolean))]
  // Evita .in() con troppi URL che tronca la richiesta HTTP
  const { data: allStmts } = await supabase
    .from('statements')
    .select('file_url')
    .eq('sede_id', sedeId)

  const allExistingUrls = new Set((allStmts ?? []).map(s => s.file_url).filter(Boolean))
  const existingUrls = new Set(pendingFileUrls.filter(u => allExistingUrls.has(u)))

  // Deduplica per file_url e filtra quelli già processati
  const seenUrls = new Set<string>()
  const pendingFiltered = (pendingDocs ?? []).filter(d => {
    if (!d.file_url || existingUrls.has(d.file_url)) return false
    if (seenUrls.has(d.file_url)) return false
    seenUrls.add(d.file_url)
    return true
  })

  // Resolve fornitore names for pending docs
  const pfIds = [...new Set(pendingFiltered.map(d => d.fornitore_id).filter(Boolean) as string[])]
  const pendingFornitoreMap: Record<string, string> = {}
  if (pfIds.length > 0) {
    const { data: fornitori } = await supabase.from('fornitori').select('id, nome').in('id', pfIds)
    for (const f of fornitori ?? []) pendingFornitoreMap[f.id] = f.nome
  }

  const pendingListWithFornitore = pendingFiltered.map(d => ({
    id: d.id,
    file_name: d.file_name,
    email_subject: d.oggetto_mail,
    created_at: d.created_at,
    fornitore_nome: d.fornitore_id ? (pendingFornitoreMap[d.fornitore_id] ?? null) : null,
  }))

  const righe_anomale = await countAnomalousStatementRows(supabase, sedeId)

  return NextResponse.json({
    total,
    con_anomalie: conAnomalie,
    anomalie_totali: anomalieTotali,
    righe_anomale,
    recenti,
    pending_count: pendingListWithFornitore.length,
    pending_list: pendingListWithFornitore,
  })
}

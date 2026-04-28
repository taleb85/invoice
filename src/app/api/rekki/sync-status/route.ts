import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'

export async function GET(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fornitoreId = searchParams.get('fornitore_id')
  if (!fornitoreId) return NextResponse.json({ error: 'fornitore_id richiesto' }, { status: 400 })

  const service = createServiceClient()

  const { data: fornitore, error: fornErr } = await service
    .from('fornitori')
    .select('id, nome, sede_id')
    .eq('id', fornitoreId)
    .single()

  if (fornErr || !fornitore) {
    return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })
  }

  try {
    // ── Sede: IMAP configurato + ultima sync ──────────────────────────────
    const { data: sedeData } = await service
      .from('sedi')
      .select('imap_host, imap_user, last_imap_sync_at')
      .eq('id', fornitore.sede_id)
      .maybeSingle()

    const imapConfigured = !!(sedeData?.imap_host?.trim() && sedeData?.imap_user?.trim())

    // Ultima sync: primo dall'ultimo log del fornitore, poi dalla sede
    const { data: lastFornitoreLog } = await service
      .from('log_sincronizzazione')
      .select('created_at')
      .eq('fornitore_id', fornitoreId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastSyncAt: string | null =
      lastFornitoreLog?.created_at ??
      (sedeData as { last_imap_sync_at?: string | null } | null)?.last_imap_sync_at ??
      null

    // ── Email elaborate per questo fornitore (log_sincronizzazione) ────────
    const { count: emailsElaborate } = await service
      .from('log_sincronizzazione')
      .select('id', { count: 'exact', head: true })
      .eq('fornitore_id', fornitoreId)
      .eq('stato', 'successo')

    // ── Documenti totali trovati per questo fornitore ─────────────────────
    const { count: documentiTotali } = await service
      .from('documenti_da_processare')
      .select('id', { count: 'exact', head: true })
      .eq('fornitore_id', fornitoreId)

    // ── Documenti già abbinati ────────────────────────────────────────────
    const { count: documentiAbbinati } = await service
      .from('documenti_da_processare')
      .select('id', { count: 'exact', head: true })
      .eq('fornitore_id', fornitoreId)
      .eq('stato', 'associato')

    // ── Documenti ancora in coda / da abbinare ────────────────────────────
    const { count: documentiDaAbbinare } = await service
      .from('documenti_da_processare')
      .select('id', { count: 'exact', head: true })
      .eq('fornitore_id', fornitoreId)
      .in('stato', ['da_associare', 'in_attesa', 'bozza_creata', 'da_revisionare'])

    // ── Log recenti (ultimi 15) per questo fornitore ──────────────────────
    const { data: recentLogs } = await service
      .from('log_sincronizzazione')
      .select('id, created_at, oggetto_mail, mittente, stato, allegato_nome, file_url')
      .eq('fornitore_id', fornitoreId)
      .order('created_at', { ascending: false })
      .limit(15)

    const status = {
      last_sync_at:         lastSyncAt,
      // KPI: email = log successo, prodotti = documenti totali
      total_emails_scanned: emailsElaborate ?? 0,
      total_products_found: documentiTotali ?? 0,
      // abbinati e da abbinare vengono restituiti separatamente
      matched_count:        documentiAbbinati ?? 0,
      unmatched_count:      documentiDaAbbinare ?? 0,
      recent_updates: (recentLogs ?? []).map(log => ({
        prodotto:      log.allegato_nome ?? log.oggetto_mail ?? '—',
        email_date:    log.created_at,
        email_subject: log.oggetto_mail ?? null,
        is_matched:    log.stato === 'successo' && !!log.file_url,
      })),
      new_suppliers_found: [],
      imap_configured:     imapConfigured,
    }

    return NextResponse.json({ status })

  } catch (err) {
    console.error('[SYNC-STATUS]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Errore sconosciuto' },
      { status: 500 },
    )
  }
}

import { NextResponse } from 'next/server'
import { createClient, createServiceClient, getProfile } from '@/utils/supabase/server'

// States that can be retried (any error state, regardless of which version created the log)
const RETRYABLE_STATES = ['bolla_non_trovata', 'fornitore_non_trovato'] as const

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Auth check via user client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato.' }, { status: 401 })

  const prof = await getProfile()
  if (prof?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo gli amministratori possono riprovare i log di sincronizzazione.' }, { status: 403 })
  }

  // 1. Fetch the log entry
  const service = createServiceClient()
  const { data: log, error: logError } = await service
    .from('log_sincronizzazione')
    .select('*')
    .eq('id', id)
    .single()

  if (logError || !log) {
    return NextResponse.json({ error: 'Log non trovato.' }, { status: 404 })
  }

  if (!RETRYABLE_STATES.includes(log.stato)) {
    return NextResponse.json(
      { error: `Il retry è disponibile solo per log in stato di errore (trovato: "${log.stato}").` },
      { status: 400 }
    )
  }

  // A file URL is the minimum required to recreate the document record
  if (!log.file_url) {
    return NextResponse.json(
      { error: 'Nessun file associato a questo log: impossibile eseguire il retry senza un URL del documento.' },
      { status: 400 }
    )
  }

  // 2. sede_id: dal log (IMAP) oppure dal fornitore
  let sedeId: string | null = (log as { sede_id?: string | null }).sede_id ?? null
  if (!sedeId && log.fornitore_id) {
    const { data: fornitore } = await service
      .from('fornitori')
      .select('sede_id')
      .eq('id', log.fornitore_id)
      .single()
    sedeId = fornitore?.sede_id ?? null
  }

  // 3. Save to documenti_da_processare with stato 'da_associare'
  //    mittente is NOT NULL in the schema — fall back to a placeholder if missing.
  //    metadata column may not be migrated yet — use fallback insert without it.
  //    Never block on missing bolla — the user will associate it manually in Statements.
  const basePayload = {
    fornitore_id:   log.fornitore_id ?? null,
    sede_id:        sedeId,
    mittente:       log.mittente || 'sconosciuto',   // NOT NULL — no null allowed
    oggetto_mail:   log.oggetto_mail ?? null,
    file_url:       log.file_url,
    file_name:      null,
    content_type:   null,
    data_documento: null,
    stato:          'da_associare',
    metadata:       null,   // column added by migration — fallback below if missing
  }

  let { error: insertError } = await service.from('documenti_da_processare').insert([basePayload])

  // Fallback: colonna 'metadata' non ancora migrata
  if (insertError && (insertError.code === '42703' || insertError.message?.includes('metadata') || insertError.message?.includes('is_statement'))) {
    console.warn('[RETRY] Colonna extra mancante — retry senza metadata')
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { metadata: _m, is_statement: _is, ...safePayload } = basePayload as Record<string, unknown>
    const r2 = await service.from('documenti_da_processare').insert([safePayload])
    insertError = r2.error
    if (insertError) console.error('[RETRY] Fallback insert error:', insertError.message)
  }

  if (insertError) {
    console.error('[RETRY] Errore inserimento documento:', insertError.message)
    const detail = `[${insertError.code ?? 'ERR'}] ${insertError.message}${insertError.details ? ' | ' + insertError.details : ''}`
    // Write the real DB error into the log so it's visible in the UI
    await service
      .from('log_sincronizzazione')
      .update({ errore_dettaglio: `Retry fallito: ${detail}` })
      .eq('id', id)
    return NextResponse.json(
      { error: `Errore nel salvataggio del documento: ${detail}` },
      { status: 500 }
    )
  }

  // 4. Mark log as successo
  await service
    .from('log_sincronizzazione')
    .update({ stato: 'successo', errore_dettaglio: null })
    .eq('id', id)

  return NextResponse.json({
    successo: true,
    messaggio: 'Documento salvato come "da associare". Vai in Statements per abbinarlo alla bolla.',
  })
}

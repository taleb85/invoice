import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isAdminSedeRole } from '@/lib/roles'
import {
  processLegacyPendingDoc,
  type LegacyPendingDocRow,
} from '@/lib/reprocess-pending-docs-ocr'
import { OcrInvoiceConfigurationError } from '@/lib/ocr-invoice'

export const dynamic = 'force-dynamic'
/** Allineato a cron/scan OCR pesanti; su Hobby Vercel resta comunque il tetto ~60s — batch piccolo sotto. */
export const maxDuration = 300

/** Per richiesta: resta sotto timeout gateway (~60s su Hobby anche se maxDuration è più alto sul Pro). */
const BATCH = 3
const FETCH_CAP = 120

type Body = { sede_id?: string }

/**
 * POST — Documenti `da_associare` con fornitore già collegato e file: OCR + auto fattura/bolla (piccolo batch per richiesta).
 * Storicamente restati senza `metadata.ocr_tipo` o con OCR incompleto.
 */
export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const role = String(profile.role ?? '').toLowerCase()
  if (role === 'operatore') {
    return NextResponse.json({ error: 'Operatore: non autorizzato' }, { status: 403 })
  }
  if (!isMasterAdminRole(profile.role) && !isAdminSedeRole(profile.role)) {
    return NextResponse.json({ error: 'Solo amministratore o responsabile sede' }, { status: 403 })
  }

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    body = {}
  }
  const sedeFromBody = typeof body?.sede_id === 'string' ? body.sede_id.trim() : ''

  if (isAdminSedeRole(profile.role)) {
    if (!sedeFromBody) {
      return NextResponse.json({ error: 'sede_id obbligatorio' }, { status: 400 })
    }
    if (profile.sede_id !== sedeFromBody) {
      return NextResponse.json({ error: 'Sede non consentita' }, { status: 403 })
    }
  }

  const sedeFilter =
    sedeFromBody || (isMasterAdminRole(profile.role) ? '' : profile.sede_id?.trim() ?? '')
  const sedeFilterOrNull = sedeFilter ? sedeFilter : null

  if (sedeFilterOrNull && !isMasterAdminRole(profile.role) && profile.sede_id !== sedeFilterOrNull) {
    return NextResponse.json({ error: 'Sede non consentita' }, { status: 403 })
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json({ error: 'GEMINI_API_KEY non configurata' }, { status: 503 })
  }

  const service = createServiceClient()

  let q = service
    .from('documenti_da_processare')
    .select(
      'id, file_url, file_name, content_type, fornitore_id, sede_id, oggetto_mail, mittente, metadata, stato, note, is_statement',
    )
    .eq('stato', 'da_associare')
    .not('fornitore_id', 'is', null)
    .not('file_url', 'is', null)
    .order('created_at', { ascending: true })
    .limit(FETCH_CAP)

  if (sedeFilterOrNull) {
    q = q.eq('sede_id', sedeFilterOrNull) as typeof q
  }

  const { data: rowsRaw, error: fetchErr } = await q

  if (fetchErr) {
    console.error('[reprocess-da-associare] fetch:', fetchErr.message)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const candidates = ((rowsRaw ?? []) as LegacyPendingDocRow[])
  const batch = candidates.slice(0, BATCH)

  let processed = 0
  let auto_saved = 0
  let da_revisionare = 0
  let errors = 0

  for (const row of batch) {
    try {
      const result = await processLegacyPendingDoc(service, row)
      if (result.status === 'error') {
        errors++
        continue
      }
      processed++
      if (result.category === 'auto_saved') auto_saved++
      else if (result.category === 'da_revisionare') da_revisionare++
    } catch (e) {
      if (e instanceof OcrInvoiceConfigurationError) {
        return NextResponse.json({ error: e.message }, { status: 503 })
      }
      errors++
      console.error('[reprocess-da-associare] doc', row.id, e)
    }
  }

  const totalFetched = candidates.length
  const otherOutcomes = Math.max(0, processed - auto_saved - da_revisionare)

  return NextResponse.json({
    processed,
    auto_saved,
    da_revisionare,
    other_outcomes: otherOutcomes,
    errors,
    batch_size: batch.length,
    fetched: totalFetched,
    /** Altri candidati nella query corrente o possibili righe oltre il FETCH_CAP. */
    has_more_candidates: totalFetched >= FETCH_CAP || totalFetched > batch.length,
  })
}

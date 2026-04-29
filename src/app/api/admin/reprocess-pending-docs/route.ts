import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isAdminSedeRole } from '@/lib/roles'
import {
  processLegacyPendingDoc,
  type LegacyPendingDocRow,
} from '@/lib/reprocess-pending-docs-ocr'
import { OcrInvoiceConfigurationError } from '@/lib/ocr-invoice'
import { classifyDocumentWithGemini, type GeminiInboxClassification } from '@/lib/gemini-inbox-classify'

export const dynamic = 'force-dynamic'
/** Riduce timeout su Vercel; batch massimo 5 documenti per richiesta. */
export const maxDuration = 60

const BATCH = 5
const FETCH_CAP = 120

type GeminiClassifyBody = {
  sede_id?: string
  mode?: 'ocr_legacy' | 'gemini_classify'
  /** Non riprocessare questi ID (batch successivi dalla UI). */
  exclude_doc_ids?: string[]
}

function metadataMissingOcrTipo(metadata: unknown): boolean {
  if (metadata == null) return true
  if (typeof metadata !== 'object' || Array.isArray(metadata)) return true
  const ot = (metadata as Record<string, unknown>).ocr_tipo
  return ot == null || ot === ''
}

/**
 * POST — Admin: OCR su documenti legacy in coda (`da_associare` senza `metadata.ocr_tipo`).
 * Scarica dal bucket privato `documenti` con il service client (mai URL pubblico).
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

  let body: GeminiClassifyBody
  try {
    body = (await req.json()) as GeminiClassifyBody
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

  // ── Gemini: solo classificazione suggerita (senza modificare DB), batch da 5 ──
  if (body.mode === 'gemini_classify') {
    const exclude = new Set(
      Array.isArray(body.exclude_doc_ids)
        ? body.exclude_doc_ids.map((x) => String(x).trim()).filter(Boolean)
        : [],
    )
    let q = service
      .from('documenti_da_processare')
      .select('id, file_url, file_name, content_type, stato, created_at')
      .in('stato', ['da_associare', 'da_revisionare'])
      /* Stesso ordine dell’Inbox AI: più recenti in cima (GET documenti-da-processare: created_at DESC). */
      .order('created_at', { ascending: false })
      .limit(120)

    if (sedeFilterOrNull) {
      q = q.or(`sede_id.eq.${sedeFilterOrNull},sede_id.is.null`) as typeof q
    }

    const { data: rawRows, error: fetchGeminiErr } = await q
    if (fetchGeminiErr) {
      console.error('[reprocess-pending-docs] gemini fetch:', fetchGeminiErr.message)
      return NextResponse.json({ error: fetchGeminiErr.message }, { status: 500 })
    }

    const rows = ((rawRows ?? []) as { id: string; file_url: string | null; file_name: string | null; content_type: string | null }[])
      .filter((r) => !exclude.has(r.id))
      .slice(0, BATCH)

    const suggestions: GeminiInboxClassification[] = []
    for (const row of rows) {
      const one = await classifyDocumentWithGemini(service, row)
      suggestions.push(one)
    }

    return NextResponse.json({
      mode: 'gemini_classify' as const,
      suggestions,
      batch_size: suggestions.length,
    })
  }

  let q = service
    .from('documenti_da_processare')
    .select(
      'id, file_url, file_name, content_type, fornitore_id, sede_id, oggetto_mail, mittente, metadata, stato, note, is_statement',
    )
    .eq('stato', 'da_associare')
    .order('created_at', { ascending: true })
    .limit(FETCH_CAP)

  if (sedeFilterOrNull) {
    q = q.eq('sede_id', sedeFilterOrNull) as typeof q
  }

  const { data: rowsRaw, error: fetchErr } = await q

  if (fetchErr) {
    console.error('[reprocess-pending-docs] fetch:', fetchErr.message)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const eligible = ((rowsRaw ?? []) as LegacyPendingDocRow[])
    .filter((r) => metadataMissingOcrTipo(r.metadata))
    .slice(0, BATCH)

  let processed = 0
  let auto_saved = 0
  let da_revisionare = 0
  let errors = 0

  for (const row of eligible) {
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
      console.error('[reprocess-pending-docs] doc', row.id, e)
    }
  }

  return NextResponse.json({
    processed,
    auto_saved,
    da_revisionare,
    errors,
  })
}

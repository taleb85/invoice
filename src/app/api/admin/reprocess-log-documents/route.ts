import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isAdminSedeRole } from '@/lib/roles'
import { processLegacyPendingDoc, type LegacyPendingDocRow } from '@/lib/reprocess-pending-docs-ocr'
import { OcrInvoiceConfigurationError } from '@/lib/ocr-invoice'
import { normalizeSenderEmailCanonical } from '@/lib/sender-email'
import { resolveFornitoreFromScanEmail } from '@/lib/fornitore-resolve-scan-email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Limite Gemini per richiesta serverless (~60s `maxDuration`). */
const BATCH_MAX = 12

type QueueRow = LegacyPendingDocRow & { stato?: string | null }

/** Stati su cui conviene ripassare OCR + registrazione auto (stessa pipeline scan-email legacy). */
const PIPELINE_RETRY_STATES = new Set([
  'da_processare',
  'in_attesa',
  'da_associare',
  'da_revisionare',
])

function statoNormalized(statoRaw: string): string {
  return statoRaw.trim() || ''
}

function rowEligibleForPipeline(row: QueueRow): boolean {
  const s = statoNormalized(String(row.stato ?? ''))
  return PIPELINE_RETRY_STATES.has(s)
}

function terminalStatoSkippedCode(statoRaw: string): LogReprocessOutcomeCode {
  const s = statoNormalized(statoRaw)
  if (s === 'scartato') return 'skipped_scartato'
  return 'skipped_already_has_ocr'
}

/** Codici leggibili dalla UI (`log.activityProc*` / mapping). */
export type LogReprocessOutcomeCode =
  | 'processed_auto'
  | 'processed_revision'
  | 'processed_other'
  | 'processed_rejected_cv'
  | 'error'
  | 'skipped_scartato'
  | 'skipped_no_row_or_sede'
  | 'skipped_no_mittente'
  | 'skipped_no_supplier_match'
  | 'skipped_already_has_ocr'
  | 'pending_next_batch'

export type LogReprocessOutcome = {
  id: string
  code: LogReprocessOutcomeCode
  detail?: string
}

function sedeAllowsRow(
  rowSede: string | null,
  viewerSedeId: string | null,
  master: boolean,
): boolean {
  if (master) return true
  if (!viewerSedeId) return false
  if (rowSede === null || rowSede === '') return true
  return rowSede === viewerSedeId
}

function categoryCode(
  c: 'auto_saved' | 'da_revisionare' | 'other' | 'rejected_cv',
): 'processed_auto' | 'processed_revision' | 'processed_other' | 'processed_rejected_cv' {
  if (c === 'auto_saved') return 'processed_auto'
  if (c === 'da_revisionare') return 'processed_revision'
  if (c === 'rejected_cv') return 'processed_rejected_cv'
  return 'processed_other'
}

/**
 * POST — Elaborazione OCR/abbinamento fornitore su documenti della coda i cui ID sono passati dalla UI (es. log attività di oggi).
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

  let body: { doc_ids?: unknown; sede_id?: unknown }
  try {
    body = (await req.json()) as { doc_ids?: unknown; sede_id?: unknown }
  } catch {
    body = {}
  }

  const master = isMasterAdminRole(profile.role)
  const sedeFromBody = typeof body?.sede_id === 'string' ? body.sede_id.trim() : ''

  if (isAdminSedeRole(profile.role)) {
    if (!sedeFromBody) {
      return NextResponse.json({ error: 'sede_id obbligatorio' }, { status: 400 })
    }
    if (profile.sede_id !== sedeFromBody) {
      return NextResponse.json({ error: 'Sede non consentita' }, { status: 403 })
    }
  }

  const viewerSedeId = master ? (sedeFromBody || null) : profile.sede_id?.trim() ?? null

  if (!master && viewerSedeId && profile.sede_id !== viewerSedeId) {
    return NextResponse.json({ error: 'Sede non consentita' }, { status: 403 })
  }

  const idsRaw = Array.isArray(body.doc_ids) ? body.doc_ids : []
  const docIds = idsRaw.map((x) => String(x).trim()).filter(Boolean).slice(0, 120)
  if (docIds.length === 0) {
    return NextResponse.json({ error: 'doc_ids vuoto o non valido' }, { status: 400 })
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json({ error: 'GEMINI_API_KEY non configurata' }, { status: 503 })
  }

  const service = createServiceClient()

  const { data: rowsRaw, error: fetchErr } = await service
    .from('documenti_da_processare')
    .select(
      'id, file_url, file_name, content_type, fornitore_id, sede_id, oggetto_mail, mittente, metadata, note, is_statement, stato',
    )
    .in('id', docIds)

  if (fetchErr) {
    console.error('[reprocess-log-documents] fetch:', fetchErr.message)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const byId = new Map(((rowsRaw ?? []) as QueueRow[]).map((r) => [r.id, r]))

  let runs = 0
  let processed = 0
  let autoSaved = 0
  let daRevisionareDelta = 0
  let skipped = 0
  let runsRemaining = BATCH_MAX
  const errors: { id: string; message: string }[] = []
  const rowOutcomes: LogReprocessOutcome[] = []

  for (const requestedId of docIds) {
    const row = byId.get(requestedId)
    if (!row || !sedeAllowsRow(row.sede_id ?? null, viewerSedeId, master)) {
      skipped++
      rowOutcomes.push({ id: requestedId, code: 'skipped_no_row_or_sede' })
      continue
    }

    const stato = statoNormalized(String(row.stato ?? ''))

    if (stato === 'scartato') {
      skipped++
      rowOutcomes.push({ id: requestedId, code: 'skipped_scartato' })
      continue
    }

    let toProcess: LegacyPendingDocRow | null = null

    /** `da_revisionare` senza fornitore: prova mittente→anagrafica come in scan-email. */
    if (stato === 'da_revisionare' && !row.fornitore_id?.trim()) {
      const emailNorm = normalizeSenderEmailCanonical(row.mittente)
      if (!emailNorm?.includes('@')) {
        skipped++
        rowOutcomes.push({ id: requestedId, code: 'skipped_no_mittente' })
        continue
      }
      const fornitore = await resolveFornitoreFromScanEmail(service, emailNorm, row.sede_id ?? null)
      if (!fornitore?.id) {
        skipped++
        rowOutcomes.push({ id: requestedId, code: 'skipped_no_supplier_match' })
        continue
      }
      toProcess = { ...row, fornitore_id: fornitore.id }
    } else if (rowEligibleForPipeline(row)) {
      /** OCR completo ma senza match fornitore, o nuovo stato `da_processare` / legacy `in_attesa`. */
      toProcess = row
    } else {
      skipped++
      rowOutcomes.push({ id: requestedId, code: terminalStatoSkippedCode(stato) })
      continue
    }

    if (runsRemaining <= 0) {
      rowOutcomes.push({ id: requestedId, code: 'pending_next_batch' })
      continue
    }

    runsRemaining--
    runs++
    try {
      const result = await processLegacyPendingDoc(service, toProcess)
      if (result.status === 'error') {
        errors.push({ id: row.id, message: result.message })
        rowOutcomes.push({ id: requestedId, code: 'error', detail: result.message })
        continue
      }
      processed++
      if (result.category === 'auto_saved') autoSaved++
      else if (result.category === 'da_revisionare') daRevisionareDelta++
      rowOutcomes.push({ id: requestedId, code: categoryCode(result.category) })
    } catch (e) {
      if (e instanceof OcrInvoiceConfigurationError) {
        return NextResponse.json({ error: e.message }, { status: 503 })
      }
      const msg = e instanceof Error ? e.message : String(e)
      errors.push({ id: row.id, message: msg })
      rowOutcomes.push({ id: requestedId, code: 'error', detail: msg })
    }
  }

  return NextResponse.json({
    ok: true,
    runs,
    processed,
    auto_saved: autoSaved,
    da_revisionare: daRevisionareDelta,
    skipped,
    errors,
    row_outcomes: rowOutcomes,
  })
}

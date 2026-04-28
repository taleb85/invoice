import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ocrInvoice,
  OcrInvoiceConfigurationError,
  OcrTransientError,
  type OcrResult,
} from '@/lib/ocr-invoice'
import { safeDate } from '@/lib/safe-date'
import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'
import { insertEmailAutoBolla, insertEmailAutoFattura } from '@/lib/email-sync-auto-register-core'
import {
  emailSubjectLooksLikeStatement,
  inferAutoPendingKindFromEmailScan,
  inferPendingDocumentKindForQueueRow,
} from '@/lib/document-bozza-routing'
import { fetchFornitorePendingKindHint, ocrTipoHintKey } from '@/lib/fornitore-doc-type-hints'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { inferContentTypeFromBuffer, resolvedContentTypeFromFetch } from '@/lib/fix-ocr-dates-helpers'

export type LegacyPendingDocRow = {
  id: string
  file_url: string | null
  file_name: string | null
  content_type: string | null
  fornitore_id: string | null
  sede_id: string | null
  oggetto_mail: string | null
  mittente: string | null
  metadata: Record<string, unknown> | null
  note: string | null
  is_statement?: boolean | null
}

type Fornitore = {
  id: string
  nome: string
  sede_id: string | null
  language?: string | null
  rekki_link?: string | null
  rekki_supplier_id?: string | null
  email?: string | null
}

type MatchedBy =
  | 'email'
  | 'alias'
  | 'domain'
  | 'piva'
  | 'ragione_sociale'
  | 'rekki_supplier'
  | 'unknown'

function buildMetadata(
  ocr: OcrResult,
  matchedBy: MatchedBy,
): Record<string, unknown> {
  return {
    ragione_sociale: ocr.ragione_sociale,
    p_iva: ocr.p_iva,
    indirizzo: ocr.indirizzo ?? null,
    data_fattura: ocr.data_fattura,
    numero_fattura: ocr.numero_fattura,
    tipo_documento: ocr.tipo_documento ?? null,
    totale_iva_inclusa: ocr.totale_iva_inclusa,
    importo_raw: ocr.importo_raw ?? null,
    formato_importo: ocr.formato_importo ?? null,
    estrazione_utile: ocr.estrazione_utile ?? undefined,
    matched_by: matchedBy,
  }
}

export type ProcessLegacyPendingDocResult =
  | { status: 'ok'; category: 'auto_saved' | 'da_revisionare' | 'other' }
  | { status: 'error'; message: string }

/**
 * Una passata OCR su una riga legacy `documenti_da_processare` (stato da_associare, senza metadata.ocr_tipo):
 * scarica da Storage (bucket privato), Gemini OCR, auto-registro bolla/fattura come scan-email.
 */
export async function processLegacyPendingDoc(
  service: SupabaseClient,
  row: LegacyPendingDocRow,
): Promise<ProcessLegacyPendingDocResult> {
  const url = (row.file_url ?? '').trim()
  if (!url) {
    return { status: 'error', message: 'file_url mancante' }
  }

  const dl = await downloadStorageObjectByFileUrl(service, url)
  if ('error' in dl) {
    return { status: 'error', message: `Download: ${dl.error}` }
  }

  let contentType = resolvedContentTypeFromFetch(url, dl.contentType)
  if (contentType !== 'application/pdf' && !contentType.startsWith('image/')) {
    const sniffed = inferContentTypeFromBuffer(dl.data)
    if (sniffed) contentType = sniffed
  }
  if (contentType !== 'application/pdf' && !contentType.startsWith('image/')) {
    return { status: 'error', message: `Tipo non supportato: ${contentType}` }
  }

  let fornitore: Fornitore | null = null
  let matchedBy: MatchedBy = 'unknown'

  if (row.fornitore_id?.trim()) {
    const { data: fr, error } = await service
      .from('fornitori')
      .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id, email')
      .eq('id', row.fornitore_id.trim())
      .maybeSingle()
    if (error || !fr) {
      return { status: 'error', message: 'Fornitore collegato non trovato' }
    }
    fornitore = fr as Fornitore
    matchedBy = 'unknown'
  }

  let ocr: OcrResult
  try {
    ocr = await ocrInvoice(dl.data, contentType, fornitore?.language ?? undefined, {
      logContext: {
        supabase: service,
        mittente: row.mittente ?? 'legacy-reprocess',
        oggetto_mail: row.oggetto_mail,
        file_name: row.file_name,
        fornitore_id: row.fornitore_id,
        file_url: row.file_url,
        sede_id: row.sede_id,
      },
    })
  } catch (e) {
    if (e instanceof OcrInvoiceConfigurationError) throw e
    if (e instanceof OcrTransientError) {
      return { status: 'error', message: e.message }
    }
    throw e
  }

  /** Nessuna inferenza P.IV.A / Rekki / fuzzy: mittente deve essere in rubrica (retroattiva via `/api/documenti-revisione-auto`). */

  const existingMeta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? { ...row.metadata }
      : {}

  const ocrTipoNorm = normalizeTipoDocumento(ocr.tipo_documento)
  const ocrTipoStored = ocrTipoNorm ?? 'unknown'

  const noteFromEmailBody = ocr.note_corpo_mail?.trim() || row.note?.trim() || null

  const autoPendingKind = inferAutoPendingKindFromEmailScan(
    row.oggetto_mail,
    row.file_name,
    null,
    ocr,
  )

  const ocrMetaForInfer = {
    ragione_sociale: ocr.ragione_sociale,
    note_corpo_mail: ocr.note_corpo_mail,
    tipo_documento: ocr.tipo_documento ?? null,
    numero_fattura: ocr.numero_fattura,
    totale_iva_inclusa: ocr.totale_iva_inclusa ?? null,
  }

  const ocrTipoKey = ocrTipoHintKey(ocr.tipo_documento)
  const learnedPendingKind = fornitore?.id
    ? await fetchFornitorePendingKindHint(service, fornitore.id, ocrTipoKey)
    : null

  const effectivePendingKind = autoPendingKind ?? learnedPendingKind

  const treatAsStatement = effectivePendingKind === 'statement'
  const skipAutoBozza = treatAsStatement || effectivePendingKind === 'ordine'

  let registratoAutoFatturaId: string | null = null
  let registratoAutoBollaId: string | null = null
  let duplicateSkippedFatturaId: string | null = null
  let needsDocRevision = false

  const documentSedeId = row.sede_id ?? fornitore?.sede_id ?? null

  const inferredKind = inferPendingDocumentKindForQueueRow({
    oggetto_mail: row.oggetto_mail,
    file_name: row.file_name,
    metadata: ocrMetaForInfer,
  })

  let targetKind: 'fattura' | 'bolla' | null = null
  if (inferredKind === 'fattura') targetKind = 'fattura'
  else if (inferredKind === 'bolla') targetKind = 'bolla'
  else targetKind = null

  const suggestedPendingKind: 'fattura' | 'bolla' =
    effectivePendingKind === 'fattura' || effectivePendingKind === 'bolla'
      ? effectivePendingKind
      : normalizeTipoDocumento(ocr.tipo_documento) === 'bolla'
        ? 'bolla'
        : 'fattura'

  if (fornitore?.id && documentSedeId && !skipAutoBozza) {
    const dataDocLocal = safeDate(ocr.data_fattura) ?? new Date().toISOString().slice(0, 10)

    if (targetKind === 'fattura') {
      const res = await insertEmailAutoFattura(service, {
        fornitoreId: fornitore.id,
        sedeId: documentSedeId,
        dataDoc: dataDocLocal,
        fileUrl: url,
        meta: { numero_fattura: ocr.numero_fattura, totale_iva_inclusa: ocr.totale_iva_inclusa },
      })
      if ('id' in res) {
        registratoAutoFatturaId = res.id
        const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '') || 'http://localhost:3000'
        fetch(`${baseUrl}/api/price-anomalies/check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {}),
          },
          body: JSON.stringify({ fattura_id: res.id, fornitore_id: fornitore.id }),
        }).catch(() => {})
      } else if ('duplicateId' in res) {
        duplicateSkippedFatturaId = res.duplicateId
        needsDocRevision = true
      }
    } else if (targetKind === 'bolla') {
      const numRef = ocr.numero_fattura?.trim() || null
      const rb = await insertEmailAutoBolla(service, {
        fornitoreId: fornitore.id,
        sedeId: documentSedeId,
        dataDoc: dataDocLocal,
        fileUrl: url,
        numeroBolla: numRef,
        importo: ocr.totale_iva_inclusa ?? null,
      })
      if ('id' in rb) registratoAutoBollaId = rb.id
    } else {
      needsDocRevision = true
    }
  } else if (!fornitore?.id || !documentSedeId) {
    needsDocRevision = true
  }

  const pendingKindStored =
    needsDocRevision && duplicateSkippedFatturaId
      ? ('fattura' as const)
      : needsDocRevision
        ? suggestedPendingKind
        : effectivePendingKind

  const isStatementDoc = effectivePendingKind === 'statement'
  const isStatementEmail = emailSubjectLooksLikeStatement(row.oggetto_mail)

  const metadata: Record<string, unknown> = {
    ...existingMeta,
    ...buildMetadata(ocr, matchedBy),
    ocr_tipo: ocrTipoStored,
    ...(pendingKindStored ? { pending_kind: pendingKindStored } : {}),
    ...(duplicateSkippedFatturaId ? { duplicate_skipped_fattura_id: duplicateSkippedFatturaId } : {}),
    ...(registratoAutoFatturaId || registratoAutoBollaId ? { salvato_automaticamente: true as const } : {}),
    ...(fornitore?.rekki_link?.trim() ? { rekki_link: fornitore.rekki_link.trim() } : {}),
    ...(fornitore?.rekki_supplier_id?.trim()
      ? { rekki_supplier_id: fornitore.rekki_supplier_id.trim() }
      : {}),
  }

  const rowStato: 'associato' | 'da_associare' | 'da_revisionare' = isStatementEmail
    ? 'associato'
    : skipAutoBozza
      ? 'da_associare'
      : registratoAutoFatturaId || registratoAutoBollaId
        ? 'associato'
        : needsDocRevision
          ? 'da_revisionare'
          : 'da_associare'

  const { error: updErr } = await service
    .from('documenti_da_processare')
    .update({
      fornitore_id: fornitore?.id ?? row.fornitore_id,
      metadata,
      stato: rowStato,
      data_documento: safeDate(ocr.data_fattura),
      note: noteFromEmailBody,
      is_statement: isStatementDoc || row.is_statement === true,
      ...(registratoAutoFatturaId ? { fattura_id: registratoAutoFatturaId } : {}),
      ...(registratoAutoBollaId ? { bolla_id: registratoAutoBollaId } : {}),
    })
    .eq('id', row.id)

  if (updErr) {
    return { status: 'error', message: updErr.message }
  }

  if (registratoAutoFatturaId || registratoAutoBollaId) {
    return { status: 'ok', category: 'auto_saved' }
  }
  if (rowStato === 'da_revisionare') {
    return { status: 'ok', category: 'da_revisionare' }
  }
  return { status: 'ok', category: 'other' }
}

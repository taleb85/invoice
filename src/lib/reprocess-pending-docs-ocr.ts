import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeDocumentoQueueStatoForDb } from '@/lib/documenti-queue-stato'
import {
  ocrInvoice,
  OcrInvoiceConfigurationError,
  OcrTransientError,
  type OcrResult,
} from '@/lib/ocr-invoice'
import { documentDateYmdFromOcr } from '@/lib/safe-date'
import {
  importoForBollaFromOcr,
  normalizeTipoDocumento,
  ocrClassifiedAsFatturaButContentMissing,
  ocrTipoAllowsEmailAutoFattura,
} from '@/lib/ocr-tipo-documento'
import { insertEmailAutoBolla, insertEmailAutoFattura } from '@/lib/email-sync-auto-register-core'
import {
  emailSubjectLooksLikeStatement,
  inferAutoPendingKindFromEmailScan,
  inferPendingDocumentKindForQueueRow,
} from '@/lib/document-bozza-routing'
import { fetchFornitorePendingKindHint, ocrTipoHintKey } from '@/lib/fornitore-doc-type-hints'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { inferContentTypeFromBuffer, resolvedContentTypeFromFetch } from '@/lib/fix-ocr-dates-helpers'
import { inferFornitoreAfterOcr, type InferredFornitoreSource } from '@/lib/fornitore-infer-from-document'

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

/**
 * Tentativo di estrarre un numero fattura/documento dal nome file originale
 * o dall'oggetto email, quando Gemini non ha trovato nulla.
 */
function extractNumeroFromText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null
  const s = text.trim()
  const patterns = [
    /fattura[\s._\-:]*n[°o]?\.?\s*([a-zA-Z0-9][\-/a-zA-Z0-9._]{1,30})/i,
    /(?:ft|fattura|invoice|inv)[\s._\-]*(\d[\d\-/._a-zA-Z]{2,30})/i,
    /(\d{4,20})[\s._\-]*(?:fattura|ft|invoice|inv)/i,
    /ordine[\s._\-]*n[°o]?\.?\s*([a-zA-Z0-9][\-/a-zA-Z0-9._]{1,30})/i,
    /numero\s*(?:fattura|documento|doc)[\s:_\-]*([a-zA-Z0-9][\-/a-zA-Z0-9._]{1,30})/i,
    /n[°o]?\.?\s*(?:fattura|doc)[\s._\-:]*([a-zA-Z0-9][\-/a-zA-Z0-9._]{1,30})/i,
    /doc\.?\s*(?:number|no)[\s._\-:]*([a-zA-Z0-9][\-/a-zA-Z0-9._]{1,30})/i,
    /([A-Z]{2,5}[\s._\-]\d{3,10}(?:[\s._\-]\d{2,4})?)/,
  ]
  for (const p of patterns) {
    const m = s.match(p)
    if (m?.[1]) {
      let v = m[1].replace(/\s+/g, '').trim()
      if (v.length > 30) v = v.slice(0, 30)
      if (v.length >= 2) return v
    }
  }
  return null
}

function buildMetadata(
  ocr: OcrResult,
  matchedBy: MatchedBy,
  opts?: {
    /** Fallback: estrai numero da nome file / oggetto mail se l'OCR non ha trovato nulla. */
    fileName?: string | null
    oggettoMail?: string | null
  },
): Record<string, unknown> {
  let numeroFattura = ocr.numero_fattura
  if (!numeroFattura) {
    numeroFattura =
      extractNumeroFromText(opts?.fileName ?? opts?.oggettoMail ?? null)
      ?? extractNumeroFromText(opts?.oggettoMail ?? opts?.fileName ?? null)
  }
  return {
    ragione_sociale: ocr.ragione_sociale,
    p_iva: ocr.p_iva,
    indirizzo: ocr.indirizzo ?? null,
    data_fattura: ocr.data_fattura,
    numero_fattura: numeroFattura,
    tipo_documento: ocr.tipo_documento ?? null,
    promessa_invio_documento:
      ocr.promessa_invio_documento === true ? true : undefined,
    totale_iva_inclusa: ocr.totale_iva_inclusa,
    importo_raw: ocr.importo_raw ?? null,
    formato_importo: ocr.formato_importo ?? null,
    estrazione_utile: ocr.estrazione_utile ?? undefined,
    matched_by: matchedBy,
    ...(ocr.ocr_cliente_estratto_come_fornitore
      ? { ocr_cliente_estratto_come_fornitore: true as const }
      : {}),
  }
}

export type ProcessLegacyPendingDocResult =
  | { status: 'ok'; category: 'auto_saved' | 'da_revisionare' | 'other' | 'rejected_cv' }
  | { status: 'error'; message: string }

export type ProcessLegacyPendingDocOptions = {
  /**
   * Se true: non usa `fornitore_id` sulla riga per OCR lingua / abbinamento; dopo OCR
   * rinnova mittente→P.IV.A→nome (es. pulsante «Rianalizza» sulla coda documenti).
   */
  ignoreLinkedFornitore?: boolean
}

function inferredSourceToMatchedBy(s: InferredFornitoreSource): MatchedBy {
  switch (s) {
    case 'email':
      return 'email'
    case 'piva':
      return 'piva'
    case 'rekki_supplier':
      return 'rekki_supplier'
    case 'ragione_sociale':
      return 'ragione_sociale'
    case 'cross_check':
      return 'ragione_sociale'
    default:
      return 'unknown'
  }
}

/**
 * Una passata OCR su una riga legacy `documenti_da_processare` (stato da_associare, senza metadata.ocr_tipo):
 * scarica da Storage (bucket privato), Gemini OCR, auto-registro bolla/fattura come scan-email.
 */
export async function processLegacyPendingDoc(
  service: SupabaseClient,
  row: LegacyPendingDocRow,
  options?: ProcessLegacyPendingDocOptions,
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

  if (!options?.ignoreLinkedFornitore && row.fornitore_id?.trim()) {
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
        fornitore_id: options?.ignoreLinkedFornitore ? null : row.fornitore_id,
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

  if (!fornitore) {
    const inferred = await inferFornitoreAfterOcr(service, ocr, {
      mittente: row.mittente,
      sede_id: row.sede_id,
      metadata: row.metadata,
      emailBodyText: row.note ?? undefined,
    })
    if (inferred?.fornitore?.id) {
      fornitore = inferred.fornitore as Fornitore
      matchedBy = inferredSourceToMatchedBy(inferred.source)
    }
  }

  // ── Catena di qualità: valida fornitore, data e tipo documento (2/3 segnali) ──
  // Se la confidenza è < 2 su qualsiasi campo, forza da_revisionare.
  let qualityForcesReview = false
  let qualityDate: string | null = null
  let qualityType: string | null = null
  try {
    const { runQualityChain } = await import('@/lib/document-quality-chain')
    const quality = await runQualityChain(service, {
      mittente: row.mittente,
      sedeId: row.sede_id,
      ocrRagioneSociale: ocr.ragione_sociale,
      ocrPiva: ocr.p_iva,
      ocrDate: ocr.data_fattura,
      ocrTipo: ocr.tipo_documento,
      receivedAt: null,
      fileName: row.file_name,
      emailSubject: row.oggetto_mail,
      fornitoreId: fornitore?.id ?? null,
    })
    qualityForcesReview = quality.needsReview
    qualityDate = quality.documentDate
    qualityType = quality.documentType
  } catch {
    // Se la quality chain fallisce, procede comunque con i dati OCR
  }

  const existingMeta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? { ...row.metadata }
      : {}

  if (ocr.tipo_documento === 'comunicazione') {
    const metadata: Record<string, unknown> = {
      ...existingMeta,
      ...buildMetadata(ocr, matchedBy, { fileName: row.file_name, oggettoMail: row.oggetto_mail }),
      ocr_tipo: 'comunicazione',
      rejected_reason: 'comunicazione',
    }
    const noteFromEmailBody = ocr.note_corpo_mail?.trim() || row.note?.trim() || null
    const { error: cvErr } = await service
      .from('documenti_da_processare')
      .update({
        metadata,
        stato: normalizeDocumentoQueueStatoForDb('scartato'),
        note: noteFromEmailBody,
        data_documento: qualityDate ?? documentDateYmdFromOcr(ocr),
      })
      .eq('id', row.id)
    if (cvErr) return { status: 'error', message: cvErr.message }
    return { status: 'ok', category: 'rejected_cv' }
  }

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

  // Se la quality chain suggerisce un tipo diverso, usalo (ha 2/3 segnali)
  const finalPendingKind = qualityType ?? effectivePendingKind

  const treatAsStatement = finalPendingKind === 'statement'
  const skipAutoBozza = treatAsStatement || finalPendingKind === 'ordine'

  let registratoAutoFatturaId: string | null = null
  let registratoAutoBollaId: string | null = null
  let duplicateSkippedFatturaId: string | null = null
  let needsDocRevision = !!ocr.ocr_cliente_estratto_come_fornitore

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
      : normalizeTipoDocumento(ocr.tipo_documento) === 'bolla_ddt'
        ? 'bolla'
        : 'fattura'

  if (fornitore?.id && documentSedeId && !skipAutoBozza && !ocr.ocr_cliente_estratto_come_fornitore) {
    const dataDocLocal = documentDateYmdFromOcr(ocr)
    const todayYmd = new Date().toISOString().slice(0, 10)
    const dataDoc = dataDocLocal ?? todayYmd
    const hasDocDateFallback = !dataDocLocal

    if (targetKind === 'fattura') {
      if (hasDocDateFallback) {
        needsDocRevision = true
      } else if (!ocrTipoAllowsEmailAutoFattura(ocr.tipo_documento)) {
        needsDocRevision = true
      } else if (ocrClassifiedAsFatturaButContentMissing(ocr)) {
        needsDocRevision = true
      }
      const res = await insertEmailAutoFattura(service, {
        fornitoreId: fornitore.id,
        sedeId: documentSedeId,
        dataDoc,
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
        /**
         * La fattura è già in archivio (stessa chiave fornitore+data+numero).
         * Niente revisione manuale: chiudi la riga collegandola alla fattura
         * esistente (vedi update sotto: `rowStato='associato'`, `fattura_id`).
         */
        duplicateSkippedFatturaId = res.duplicateId
        registratoAutoFatturaId = res.duplicateId
      }
    } else if (targetKind === 'bolla') {
      if (hasDocDateFallback) needsDocRevision = true
      const numRef = ocr.numero_fattura?.trim() || null
      const rb = await insertEmailAutoBolla(service, {
        fornitoreId: fornitore.id,
        sedeId: documentSedeId,
        dataDoc,
        fileUrl: url,
        numeroBolla: numRef,
        importo: importoForBollaFromOcr(ocr),
      })
      if ('id' in rb) registratoAutoBollaId = rb.id
      else if ('duplicateId' in rb) registratoAutoBollaId = rb.duplicateId
    } else {
      needsDocRevision = true
    }
  } else if (!fornitore?.id || !documentSedeId) {
    needsDocRevision = true
  }

  // Se la quality chain ha rilevato confidenza bassa (meno di 2 segnali su 3),
  // forza la revisione manuale indipendentemente dagli altri controlli.
  if (qualityForcesReview) needsDocRevision = true

  const pendingKindStored =
    needsDocRevision && duplicateSkippedFatturaId
      ? ('fattura' as const)
      : needsDocRevision
        ? suggestedPendingKind
        : finalPendingKind

  const isStatementDoc = finalPendingKind === 'statement'
  const isStatementEmail = emailSubjectLooksLikeStatement(row.oggetto_mail)

  const metadata: Record<string, unknown> = {
    ...existingMeta,
    ...buildMetadata(ocr, matchedBy, { fileName: row.file_name, oggettoMail: row.oggetto_mail }),
    ocr_tipo: ocrTipoStored,
    ...(pendingKindStored ? { pending_kind: pendingKindStored } : {}),
    ...(duplicateSkippedFatturaId ? { duplicate_skipped_fattura_id: duplicateSkippedFatturaId } : {}),
    ...(registratoAutoFatturaId || registratoAutoBollaId ? { salvato_automaticamente: true as const } : {}),
    ...(fornitore?.rekki_link?.trim() ? { rekki_link: fornitore.rekki_link.trim() } : {}),
    ...(fornitore?.rekki_supplier_id?.trim()
      ? { rekki_supplier_id: fornitore.rekki_supplier_id.trim() }
      : {}),
  }

  const rowStato: 'associato' | 'da_associare' | 'da_revisionare' =
    ocr.ocr_cliente_estratto_come_fornitore === true
      ? 'da_revisionare'
      : isStatementEmail
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
      fornitore_id:
        options?.ignoreLinkedFornitore === true ? (fornitore?.id ?? null) : (fornitore?.id ?? row.fornitore_id),
      metadata,
      stato: normalizeDocumentoQueueStatoForDb(rowStato),
      data_documento: documentDateYmdFromOcr(ocr),
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

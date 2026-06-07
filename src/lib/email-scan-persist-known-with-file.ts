import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScannedEmail } from '@/lib/mail-scanner'
import type { OcrResult } from '@/lib/ocr-invoice'
import { normalizeNumeroBolla } from '@/lib/fix-ocr-dates-helpers'
import { ocrStatement, extractedPdfDatesToJson } from '@/lib/ocr-statement'
import { autoRegisterCombinedPdfInvoiceAfterStatement } from '@/lib/statement-combined-pdf-invoice'
import { resolveStatementDocumentDate } from '@/lib/statement-official-date'
import { runTripleCheck } from '@/lib/triple-check'
import { persistRekkiOrderStatement } from '@/lib/rekki-statement'
import { documentContextText, processingDocumentDateYmdFromOcr, safeDate } from '@/lib/safe-date'
import { recordAiUsage } from '@/lib/ai-usage-log'
import {
  emailSubjectLooksLikeStatement,
  inferAutoPendingKindFromEmailScan,
  inferPendingDocumentKindForQueueRow,
  scanContextLooksLikePaymentReceiptDoc,
  scanContextLooksLikeSupplierCommunicationDoc,
  subjectLooksLikeInvoice,
} from '@/lib/document-bozza-routing'
import { fetchFornitorePendingKindHint, ocrTipoHintKey } from '@/lib/fornitore-doc-type-hints'
import { insertEmailAutoBolla, insertEmailAutoFattura } from '@/lib/email-sync-auto-register-core'
import { quantitaForBollaFromOcr } from '@/lib/bolla-quantita'
import {
  importoForBollaFromOcr,
  normalizeTipoDocumento,
  ocrClassifiedAsFatturaButContentMissing,
  ocrTipoAllowsEmailAutoFattura,
} from '@/lib/ocr-tipo-documento'
import { shouldSkipEmailAutoFattura } from '@/lib/uk-account-invoice-guard'
import { numeroLooksLikeSalesDeliveryNoteReference } from '@/lib/sales-delivery-note-reference'
import {
  buildPdfSegmentQueueMetadata,
  extraPdfSegmentsForQueue,
} from '@/lib/ocr-pdf-multi-queue'
import { normalizeDocumentoQueueStatoForDb } from '@/lib/documenti-queue-stato'
import { isLikelyRekkiEmail, parseRekkiFromEmailParts, type RekkiLine } from '@/lib/rekki-parser'
import type { FornitoreScanFullRow } from '@/lib/scan-email-ocr-bootstrap-fornitore'

type EmailSyncDocumentKind = 'all' | 'fornitore' | 'bolla' | 'fattura' | 'estratto_conto'

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
    data_ordine: ocr.data_ordine ?? null,
    numero_fattura: ocr.numero_fattura,
    tipo_documento: ocr.tipo_documento ?? null,
    promessa_invio_documento: ocr.promessa_invio_documento === true ? true : undefined,
    totale_iva_inclusa: ocr.totale_iva_inclusa,
    quantita_totale: ocr.quantita_totale ?? null,
    importo_raw: ocr.importo_raw ?? null,
    formato_importo: ocr.formato_importo ?? null,
    estrazione_utile: ocr.estrazione_utile ?? undefined,
    matched_by: matchedBy,
    ...(ocr.ocr_cliente_estratto_come_fornitore ? { ocr_cliente_estratto_come_fornitore: true as const } : {}),
    ...(ocr.segmenti_pdf?.length ? { segmenti_pdf: ocr.segmenti_pdf } : {}),
  }
}

type LogStato =
  | 'successo'
  | 'fornitore_non_trovato'
  | 'bolla_non_trovata'
  | 'fornitore_suggerito'
  | 'documento_non_fiscale'

async function insertDocumentoQueue(supabase: SupabaseClient, payload: Record<string, unknown>) {
  const stato = normalizeDocumentoQueueStatoForDb(payload.stato)
  const payloadNorm = { ...payload, stato }
  const { error } = await supabase.from('documenti_da_processare').insert([payloadNorm])
  if (error) {
    if (
      error.code === '42703' ||
      error.message?.includes('metadata') ||
      error.message?.includes('is_statement') ||
      error.message?.includes('note')
    ) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { metadata: _sm, is_statement: _sis, note: _sn, ...rest } = payloadNorm as Record<string, unknown>
      const safePayload = { ...rest }
      const statoSafe = normalizeDocumentoQueueStatoForDb(safePayload.stato)
      const { error: e2 } = await supabase
        .from('documenti_da_processare')
        .insert([{ ...safePayload, stato: statoSafe }])
      return e2
    }
  }
  return error
}

async function insertSyncLog(
  supabase: SupabaseClient,
  email: ScannedEmail,
  stato: LogStato,
  opts: {
    fornitore_id?: string
    file_url?: string
    errore_dettaglio?: string
    sede_id?: string | null
    allegato_nome?: string | null
    scan_attachment_fingerprint?: string | null
  } = {},
) {
  await supabase.from('log_sincronizzazione').insert([
    {
      mittente: email.from,
      oggetto_mail: email.subject ?? null,
      stato,
      fornitore_id: opts.fornitore_id ?? null,
      file_url: opts.file_url ?? null,
      errore_dettaglio: opts.errore_dettaglio ?? null,
      sede_id: opts.sede_id ?? null,
      allegato_nome: opts.allegato_nome ?? null,
      imap_uid: email.uid ?? null,
      scan_attachment_fingerprint: opts.scan_attachment_fingerprint ?? null,
    },
  ])
}

async function processStatementInBackground(
  supabase: SupabaseClient,
  opts: {
    fornitoreId: string
    sedeId: string | null
    fileUrl: string
    subject: string | null
    buffer: Buffer | Uint8Array
    contentType: string
  },
) {
  const { fornitoreId, sedeId, fileUrl, subject, buffer, contentType } = opts

  const { data: stmtRow, error: stmtErr } = await supabase
    .from('statements')
    .insert([
      {
        sede_id: sedeId,
        fornitore_id: fornitoreId,
        email_subject: subject,
        file_url: fileUrl,
        status: 'processing',
        total_rows: 0,
        missing_rows: 0,
      },
    ])
    .select('id')
    .single()

  if (stmtErr || !stmtRow) {
    return
  }

  const statementId = stmtRow.id
  const ocr = await ocrStatement(buffer, contentType, undefined, {
    onUsage: (usage) =>
      void recordAiUsage(supabase, {
        sede_id: sedeId,
        tipo: 'ocr_statement',
        usage,
      }),
  })
  const rows = ocr.rows
  const extractedPdfDates = extractedPdfDatesToJson(ocr.extractedPdfDates)

  if (!rows.length) {
    await supabase
      .from('statements')
      .update({ status: 'error', total_rows: 0, extracted_pdf_dates: extractedPdfDates })
      .eq('id', statementId)
    return
  }

  const { results } = await runTripleCheck(supabase, rows, sedeId, fornitoreId)

  const rowInserts = results.map((r) => ({
    statement_id: statementId,
    numero_doc: r.numero,
    importo: r.importoStatement,
    data_doc: rows.find((row) => row.numero === r.numero)?.data ?? null,
    check_status: r.status,
    delta_importo: r.deltaImporto,
    fattura_id: r.fattura?.id ?? null,
    fattura_numero: r.fattura?.numero_fattura ?? null,
    fornitore_id: r.fornitore?.id ?? fornitoreId,
    bolle_json: r.bolle.length ? r.bolle : null,
  }))

  const { error: rowsErr } = await supabase.from('statement_rows').insert(rowInserts)
  if (rowsErr) {
    await supabase.from('statements').update({ status: 'error' }).eq('id', statementId)
    return
  }

  const missingRows = results.filter((r) => r.status !== 'ok').length
  await supabase.from('statements').update({
    status: 'done',
    total_rows: results.length,
    missing_rows: missingRows,
    extracted_pdf_dates: extractedPdfDates,
    document_date: resolveStatementDocumentDate(extractedPdfDates),
  }).eq('id', statementId)

  if (process.env.GEMINI_API_KEY?.trim()) {
    let rowsSum: number | null = null
    {
      let sum = 0
      let n = 0
      for (const r of results) {
        if (Number.isFinite(r.importoStatement)) {
          sum += r.importoStatement
          n++
        }
      }
      if (n > 0) rowsSum = Math.round(sum * 100) / 100
    }
    const docDate = resolveStatementDocumentDate(extractedPdfDates)
    const { data: fnRow } = await supabase
      .from('fornitori')
      .select('nome, display_name')
      .eq('id', fornitoreId)
      .maybeSingle()
    const fornitoreNome =
      (fnRow as { display_name?: string | null; nome?: string } | null)?.display_name ||
      (fnRow as { nome?: string } | null)?.nome ||
      null
    try {
      await autoRegisterCombinedPdfInvoiceAfterStatement(supabase, {
        statementId,
        fornitoreId,
        sedeId,
        fileUrl,
        documentDate: docDate,
        pdfBuffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
        contentType,
        statementRowsSum: rowsSum,
        emailBodyText: subject,
        fornitoreNome,
      })
    } catch {
      /* non-blocking */
    }
  }
}

export type PersistKnownScanCounters = {
  ricevuti: number
  ignorate: number
  bozzaCreate: number
}

/**
 * Persiste un documento già su Storage come per fase 2 scan-email (fornitore noto), con auto-fattura/bolla.
 * Usato quando il file è già stato caricato (es. fallback corpo email / solo testo).
 */
export async function persistKnownFornitoreEmailScanWithFile(
  supabase: SupabaseClient,
  args: {
    email: ScannedEmail
    fornitore: FornitoreScanFullRow
    matchedBy: MatchedBy
    ocr: OcrResult
    file_url: string
    storedFileName: string | null
    storedContentType: string | null
    isSyntheticBodyDoc: boolean
    fp: string
    docKind: EmailSyncDocumentKind
    sedeFilter?: string
    fallbackSedeId?: string
    effectiveSede: string | null
    rekkiPersistedUids: Set<number>
    attachmentBuffer?: Buffer | Uint8Array | null
    attachmentContentType?: string | null
  },
  counters: PersistKnownScanCounters,
): Promise<void> {
  const {
    email,
    fornitore,
    matchedBy,
    ocr,
    file_url,
    storedFileName,
    storedContentType,
    isSyntheticBodyDoc,
    fp,
    docKind,
    sedeFilter,
    fallbackSedeId,
    effectiveSede,
    rekkiPersistedUids,
    attachmentBuffer,
    attachmentContentType,
  } = args

  const documentSedeId = sedeFilter ?? fornitore.sede_id ?? fallbackSedeId ?? effectiveSede ?? null
  const noteFromEmailBody = ocr.note_corpo_mail?.trim() || null
  const bodySnippet = email.bodyText?.slice(0, 12_000) ?? null
  const isPaymentReceiptDoc = scanContextLooksLikePaymentReceiptDoc(
    email.subject,
    storedFileName,
  )
  const isSupplierCommunicationDoc = scanContextLooksLikeSupplierCommunicationDoc(
    email.subject,
    storedFileName,
  )

  const autoPendingKind = inferAutoPendingKindFromEmailScan(
    email.subject,
    storedFileName,
    bodySnippet,
    ocr,
  )
  const ocrTipoKey = ocrTipoHintKey(ocr.tipo_documento)
  const learnedPendingKind = fornitore.id
    ? await fetchFornitorePendingKindHint(supabase, fornitore.id, ocrTipoKey)
    : null
  // A learned 'statement' hint must not win when the subject explicitly signals an invoice.
  const subjectIsExplicitlyInvoice = subjectLooksLikeInvoice(email.subject) || subjectLooksLikeInvoice(storedFileName)
  // A learned 'fattura'/'bolla'/'nota_credito' hint beats auto-inferred 'statement' from email heuristics:
  // se l'utente ha già corretto manualmente questo tipo di documento per questo fornitore, lo rispettiamo.
  const learnedOverridesAutoStatement =
    autoPendingKind === 'statement' &&
    (learnedPendingKind === 'fattura' || learnedPendingKind === 'bolla' || learnedPendingKind === 'nota_credito')
  // "Ordine" rilevato dai pattern testuali (Order Confirmation, conferma ordine, ecc.)
  // è ASSOLUTO: nessun learned hint può sovrascriverlo. Vedi nota in scan-emails/route.ts.
  const effectivePendingKind =
    isPaymentReceiptDoc || isSupplierCommunicationDoc
      ? ('comunicazione' as const)
      : autoPendingKind === 'ordine'
      ? ('ordine' as const)
      : learnedOverridesAutoStatement
        ? learnedPendingKind
        : autoPendingKind ?? (
            subjectIsExplicitlyInvoice && learnedPendingKind === 'statement' ? null : learnedPendingKind
          )
  const treatAsStatement = effectivePendingKind === 'statement'
  const isStatementEmail = emailSubjectLooksLikeStatement(email.subject)
  const isStatementDoc = effectivePendingKind === 'statement'

  let registratoAutoFatturaId: string | null = null
  let registratoAutoBollaId: string | null = null
  let duplicateSkippedFatturaId: string | null = null
  let duplicateSkippedBollaId: string | null = null
  let needsDocRevision = !!ocr.ocr_cliente_estratto_come_fornitore
  const skipAutoBozza =
    treatAsStatement ||
    effectivePendingKind === 'ordine' ||
    effectivePendingKind === 'comunicazione'

  const ocrMetaForInfer = {
    ragione_sociale: ocr.ragione_sociale,
    note_corpo_mail: ocr.note_corpo_mail,
    tipo_documento: ocr.tipo_documento ?? null,
    numero_fattura: ocr.numero_fattura,
    totale_iva_inclusa: ocr.totale_iva_inclusa ?? null,
  }

  const suggestedPendingKind: 'fattura' | 'bolla' =
    effectivePendingKind === 'fattura' || effectivePendingKind === 'bolla'
      ? effectivePendingKind
      : normalizeTipoDocumento(ocr.tipo_documento) === 'bolla_ddt'
        ? 'bolla'
        : 'fattura'

  if (fornitore.id && documentSedeId && !skipAutoBozza && !ocr.ocr_cliente_estratto_come_fornitore) {
    const docContext = documentContextText(storedFileName, email.subject)
    const dataDocLocal = processingDocumentDateYmdFromOcr(ocr, docContext)
    const dataDoc = dataDocLocal
    const hasDocDateFallback = !dataDocLocal

    const inferredKind = inferPendingDocumentKindForQueueRow({
      oggetto_mail: email.subject,
      file_name: storedFileName,
      metadata: ocrMetaForInfer,
    })

    let targetKind: 'fattura' | 'bolla' | null = null
    if (docKind === 'fattura') targetKind = 'fattura'
    else if (docKind === 'bolla') targetKind = 'bolla'
    else if (inferredKind === 'fattura') targetKind = 'fattura'
    else if (inferredKind === 'bolla') targetKind = 'bolla'
    else targetKind = null

    if (targetKind === 'fattura' && numeroLooksLikeSalesDeliveryNoteReference(ocr.numero_fattura)) {
      targetKind = 'bolla'
    }

    if (targetKind === 'fattura') {
      const bypassOcrTipoGuard = args.docKind === 'fattura'
      if (isPaymentReceiptDoc || isSupplierCommunicationDoc) {
        needsDocRevision = true
      } else if (shouldSkipEmailAutoFattura(ocr)) {
        needsDocRevision = true
      } else if (hasDocDateFallback) {
        needsDocRevision = true
      } else if (!bypassOcrTipoGuard && !ocrTipoAllowsEmailAutoFattura(ocr.tipo_documento)) {
        needsDocRevision = true
      } else if (ocrClassifiedAsFatturaButContentMissing(ocr)) {
        needsDocRevision = true
      }
      if (!isPaymentReceiptDoc && !isSupplierCommunicationDoc && !shouldSkipEmailAutoFattura(ocr) && dataDoc) {
        const res = await insertEmailAutoFattura(supabase, {
          fornitoreId: fornitore.id,
          sedeId: documentSedeId,
          dataDoc,
          fileUrl: file_url,
          meta: { numero_fattura: ocr.numero_fattura, totale_iva_inclusa: ocr.totale_iva_inclusa },
        })
        if ('id' in res) {
          registratoAutoFatturaId = res.id
          counters.bozzaCreate++
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
        }
      }
    } else if (targetKind === 'bolla') {
      if (isPaymentReceiptDoc || isSupplierCommunicationDoc) {
        needsDocRevision = true
      } else if (hasDocDateFallback) needsDocRevision = true
      const numRef = normalizeNumeroBolla(ocr.numero_fattura)
      if (!isPaymentReceiptDoc && !isSupplierCommunicationDoc && dataDoc) {
        const rb = await insertEmailAutoBolla(supabase, {
          fornitoreId: fornitore.id,
          sedeId: documentSedeId,
          dataDoc,
          fileUrl: file_url,
          numeroBolla: numRef,
          importo: importoForBollaFromOcr(ocr),
          quantita: quantitaForBollaFromOcr(ocr),
        })
        if ('id' in rb) {
          registratoAutoBollaId = rb.id
          counters.bozzaCreate++
        } else if ('duplicateId' in rb) {
          duplicateSkippedBollaId = rb.duplicateId
        }
      }
    } else {
      needsDocRevision = true
    }
  }

  let earlyRekkiLines: RekkiLine[] = []
  if (!rekkiPersistedUids.has(email.uid) && email.bodyText && isLikelyRekkiEmail(email.subject, email.from, email.bodyText)) {
    earlyRekkiLines = parseRekkiFromEmailParts({ subject: email.subject, text: email.bodyText })
  }

  /**
   * Fattura già in archivio (stesso fornitore+data+numero o senza-numero+importo).
   * Niente riga `da_revisionare`: la coda non deve riproporre un duplicato a mano
   * che è semantica già risolta in archivio. Si logga solo come `successo` con
   * dettaglio per audit (`/log` mostra il `errore_dettaglio`). Le eventuali
   * righe Rekki sono già state estratte poco sopra e vanno persistite comunque.
   */
  if (duplicateSkippedFatturaId && !registratoAutoFatturaId && !registratoAutoBollaId) {
    await insertSyncLog(supabase, email, 'successo', {
      fornitore_id: fornitore.id,
      file_url,
      errore_dettaglio: `Duplicato saltato: fattura ${ocr.numero_fattura ?? ''} già in archivio (id=${duplicateSkippedFatturaId}).`.trim(),
      sede_id: documentSedeId,
      allegato_nome: storedFileName,
      scan_attachment_fingerprint: fp,
    })
    counters.ignorate++
    if (earlyRekkiLines.length && !rekkiPersistedUids.has(email.uid)) {
      rekkiPersistedUids.add(email.uid)
      persistRekkiOrderStatement(supabase, {
        fornitoreId: fornitore.id,
        sedeId: documentSedeId,
        rekkiLines: earlyRekkiLines,
        emailSubject: email.subject ?? `Rekki — ${fornitore.nome}`,
        fileUrl: file_url,
      }).catch((err) => console.error('[REKKI] persist fallito:', err))
    }
    return
  }

  if (duplicateSkippedBollaId && !registratoAutoFatturaId && !registratoAutoBollaId) {
    await insertSyncLog(supabase, email, 'successo', {
      fornitore_id: fornitore.id,
      file_url,
      errore_dettaglio: `Duplicato saltato: bolla ${ocr.numero_fattura ?? ''} già in archivio (id=${duplicateSkippedBollaId}).`.trim(),
      sede_id: documentSedeId,
      allegato_nome: storedFileName,
      scan_attachment_fingerprint: fp,
    })
    counters.ignorate++
    if (earlyRekkiLines.length && !rekkiPersistedUids.has(email.uid)) {
      rekkiPersistedUids.add(email.uid)
      persistRekkiOrderStatement(supabase, {
        fornitoreId: fornitore.id,
        sedeId: documentSedeId,
        rekkiLines: earlyRekkiLines,
        emailSubject: email.subject ?? `Rekki — ${fornitore.nome}`,
        fileUrl: file_url,
      }).catch((err) => console.error('[REKKI] persist fallito:', err))
    }
    return
  }

  const pendingKindStored =
    needsDocRevision && duplicateSkippedFatturaId
      ? ('fattura' as const)
      : needsDocRevision
        ? suggestedPendingKind
        : effectivePendingKind

  const metadata: Record<string, unknown> = {
    ...buildMetadata(ocr, matchedBy),
    ...(isSyntheticBodyDoc ? { origine_testo_email: true } : {}),
    ...(pendingKindStored ? { pending_kind: pendingKindStored } : {}),
    ...(duplicateSkippedFatturaId ? { duplicate_skipped_fattura_id: duplicateSkippedFatturaId } : {}),
    ...(duplicateSkippedBollaId ? { duplicate_skipped_bolla_id: duplicateSkippedBollaId } : {}),
    ...(registratoAutoFatturaId || registratoAutoBollaId ? { salvato_automaticamente: true as const } : {}),
    ...(fornitore.rekki_link?.trim() ? { rekki_link: fornitore.rekki_link.trim() } : {}),
    ...(fornitore.rekki_supplier_id?.trim()
      ? { rekki_supplier_id: fornitore.rekki_supplier_id.trim() }
      : {}),
    ...(earlyRekkiLines.length ? { rekki_lines: earlyRekkiLines } : {}),
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

  const knownPayload = {
    fornitore_id: fornitore.id,
    sede_id: documentSedeId,
    mittente: email.from || 'sconosciuto',
    oggetto_mail: email.subject ?? null,
    file_url,
    file_name: storedFileName,
    content_type: storedContentType,
    data_documento: processingDocumentDateYmdFromOcr(
      ocr,
      documentContextText(storedFileName, email.subject),
    ),
    stato: rowStato,
    is_statement: isStatementDoc,
    metadata,
    note: noteFromEmailBody,
    ...(registratoAutoFatturaId ? { fattura_id: registratoAutoFatturaId } : {}),
    ...(registratoAutoBollaId ? { bolla_id: registratoAutoBollaId } : {}),
  }

  const insertError = await insertDocumentoQueue(supabase, knownPayload)
  if (!insertError) {
    const extraSegs = extraPdfSegmentsForQueue(ocr)
    for (let si = 0; si < extraSegs.length; si++) {
      const seg = extraSegs[si]!
      const segMeta = buildPdfSegmentQueueMetadata(seg, si + 1)
      await insertDocumentoQueue(supabase, {
        fornitore_id: fornitore.id,
        sede_id: documentSedeId,
        mittente: email.from || 'sconosciuto',
        oggetto_mail: email.subject ?? null,
        file_url,
        file_name: storedFileName,
        content_type: storedContentType,
        data_documento:
          safeDate(seg.data_fattura) ??
          processingDocumentDateYmdFromOcr(ocr, documentContextText(storedFileName, email.subject)),
        stato: 'da_revisionare',
        is_statement: false,
        metadata: { ...metadata, ...segMeta },
        note:
          seg.pagina_inizio != null
            ? `PDF multiplo — segmento pag. ${seg.pagina_inizio}${seg.pagina_fine != null ? `–${seg.pagina_fine}` : ''}`
            : 'PDF multiplo — documento aggiuntivo nello stesso allegato',
      })
    }
  }

  if (insertError) {
    const detail = `[${insertError.code ?? 'ERR'}] ${insertError.message}${insertError.details ? ' | ' + insertError.details : ''}`
    await insertSyncLog(supabase, email, 'fornitore_non_trovato', {
      fornitore_id: fornitore.id,
      file_url,
      errore_dettaglio: detail,
      sede_id: documentSedeId,
      allegato_nome: storedFileName,
      scan_attachment_fingerprint: fp,
    })
    counters.ignorate++
    return
  }

  const stmtPdf =
    attachmentBuffer &&
    attachmentContentType &&
    (attachmentContentType === 'application/pdf' || attachmentContentType.toLowerCase().includes('pdf'))
  if (treatAsStatement && stmtPdf) {
    processStatementInBackground(supabase, {
      fornitoreId: fornitore.id,
      sedeId: documentSedeId,
      fileUrl: file_url,
      subject: email.subject ?? null,
      buffer: attachmentBuffer,
      contentType: attachmentContentType,
    }).catch((err) => console.error('[STMT] Errore background processing:', err))
  }

  await insertSyncLog(supabase, email, 'successo', {
    fornitore_id: fornitore.id,
    file_url,
    sede_id: documentSedeId,
    allegato_nome: storedFileName,
    scan_attachment_fingerprint: fp,
  })

  counters.ricevuti++

  if (earlyRekkiLines.length && !rekkiPersistedUids.has(email.uid)) {
    rekkiPersistedUids.add(email.uid)
    persistRekkiOrderStatement(supabase, {
      fornitoreId: fornitore.id,
      sedeId: documentSedeId,
      rekkiLines: earlyRekkiLines,
      emailSubject: email.subject ?? `Rekki — ${fornitore.nome}`,
      fileUrl: file_url,
    }).catch((err) => console.error('[REKKI] persist fallito:', err))
  }
}

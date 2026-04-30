import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScannedEmail } from '@/lib/mail-scanner'
import type { OcrResult } from '@/lib/ocr-invoice'
import { ocrStatement, extractedPdfDatesToJson } from '@/lib/ocr-statement'
import { runTripleCheck } from '@/lib/triple-check'
import { persistRekkiOrderStatement } from '@/lib/rekki-statement'
import { safeDate } from '@/lib/safe-date'
import { recordAiUsage } from '@/lib/ai-usage-log'
import {
  emailSubjectLooksLikeStatement,
  inferAutoPendingKindFromEmailScan,
  inferPendingDocumentKindForQueueRow,
} from '@/lib/document-bozza-routing'
import { fetchFornitorePendingKindHint, ocrTipoHintKey } from '@/lib/fornitore-doc-type-hints'
import { insertEmailAutoBolla, insertEmailAutoFattura } from '@/lib/email-sync-auto-register-core'
import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'
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
    numero_fattura: ocr.numero_fattura,
    tipo_documento: ocr.tipo_documento ?? null,
    promessa_invio_documento: ocr.promessa_invio_documento === true ? true : undefined,
    totale_iva_inclusa: ocr.totale_iva_inclusa,
    importo_raw: ocr.importo_raw ?? null,
    formato_importo: ocr.formato_importo ?? null,
    estrazione_utile: ocr.estrazione_utile ?? undefined,
    matched_by: matchedBy,
    ...(ocr.ocr_cliente_estratto_come_fornitore ? { ocr_cliente_estratto_come_fornitore: true as const } : {}),
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
  }).eq('id', statementId)
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
  const effectivePendingKind = autoPendingKind ?? learnedPendingKind
  const treatAsStatement = effectivePendingKind === 'statement'
  const isStatementEmail = emailSubjectLooksLikeStatement(email.subject)
  const isStatementDoc = effectivePendingKind === 'statement'

  let registratoAutoFatturaId: string | null = null
  let registratoAutoBollaId: string | null = null
  let duplicateSkippedFatturaId: string | null = null
  let needsDocRevision = !!ocr.ocr_cliente_estratto_come_fornitore
  const skipAutoBozza = treatAsStatement || effectivePendingKind === 'ordine'

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
      : normalizeTipoDocumento(ocr.tipo_documento) === 'bolla'
        ? 'bolla'
        : 'fattura'

  if (fornitore.id && documentSedeId && !skipAutoBozza && !ocr.ocr_cliente_estratto_come_fornitore) {
    const dataDocLocal = safeDate(ocr.data_fattura) ?? new Date().toISOString().slice(0, 10)
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

    if (targetKind === 'fattura') {
      const res = await insertEmailAutoFattura(supabase, {
        fornitoreId: fornitore.id,
        sedeId: documentSedeId,
        dataDoc: dataDocLocal,
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
        needsDocRevision = true
      }
    } else if (targetKind === 'bolla') {
      const numRef = ocr.numero_fattura?.trim() || null
      const rb = await insertEmailAutoBolla(supabase, {
        fornitoreId: fornitore.id,
        sedeId: documentSedeId,
        dataDoc: dataDocLocal,
        fileUrl: file_url,
        numeroBolla: numRef,
        importo: ocr.totale_iva_inclusa ?? null,
      })
      if ('id' in rb) {
        registratoAutoBollaId = rb.id
        counters.bozzaCreate++
      }
    } else {
      needsDocRevision = true
    }
  }

  let earlyRekkiLines: RekkiLine[] = []
  if (!rekkiPersistedUids.has(email.uid) && email.bodyText && isLikelyRekkiEmail(email.subject, email.from, email.bodyText)) {
    earlyRekkiLines = parseRekkiFromEmailParts({ subject: email.subject, text: email.bodyText })
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
    data_documento: safeDate(ocr.data_fattura),
    stato: rowStato,
    is_statement: isStatementDoc,
    metadata,
    note: noteFromEmailBody,
    ...(registratoAutoFatturaId ? { fattura_id: registratoAutoFatturaId } : {}),
    ...(registratoAutoBollaId ? { bolla_id: registratoAutoBollaId } : {}),
  }

  const insertError = await insertDocumentoQueue(supabase, knownPayload)
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

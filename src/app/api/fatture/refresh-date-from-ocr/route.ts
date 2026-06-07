import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { ocrInvoice, OcrInvoiceConfigurationError } from '@/lib/ocr-invoice'
import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'
import { fileNameFromStorageUrl } from '@/lib/fix-ocr-dates-helpers'
import {
  documentDateRejectMessage,
  resolveDocumentDateFromOcrContext,
} from '@/lib/resolve-document-date-from-ocr'
import { resolveFatturaFornitoreCorrection } from '@/lib/fattura-fornitore-reassign-from-doc'
import { reassignEntityFornitore } from '@/lib/reassign-entity-fornitore'

function resolvedContentType(url: string, header: string | null): string {
  const h = (header ?? '').toLowerCase()
  if (h.includes('pdf')) return 'application/pdf'
  if (h.includes('jpeg') || h.includes('jpg')) return 'image/jpeg'
  if (h.includes('png')) return 'image/png'
  if (h.includes('webp')) return 'image/webp'
  if (h.includes('gif')) return 'image/gif'
  const u = url.toLowerCase().split('?')[0] ?? ''
  if (u.endsWith('.pdf')) return 'application/pdf'
  if (/\.jpe?g$/i.test(u)) return 'image/jpeg'
  if (u.endsWith('.png')) return 'image/png'
  if (u.endsWith('.webp')) return 'image/webp'
  if (u.endsWith('.gif')) return 'image/gif'
  return h || 'application/octet-stream'
}

export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const acceptLang = req.headers.get('accept-language') ?? ''
  const locale = acceptLang.toLowerCase().includes('it') ? 'it' : 'en'

  let fatturaId: string
  try {
    const body = (await req.json()) as { fattura_id?: string }
    fatturaId = (body.fattura_id ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
  }
  if (!fatturaId) {
    return NextResponse.json({ error: 'fattura_id richiesto' }, { status: 400 })
  }

  const { data: fattura, error: qErr } = await service
    .from('fatture')
    .select('id, data, importo, numero_fattura, file_url, fornitore_id, sede_id, fornitore:fornitori(nome, sede_id)')
    .eq('id', fatturaId)
    .single()

  if (qErr || !fattura) {
    return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })
  }
  if (!fattura.file_url?.trim()) {
    return NextResponse.json(
      { error: 'Nessun allegato: carica un file sulla fattura per poter rileggere la data.' },
      { status: 422 },
    )
  }

  const { data: docRow } = await service
    .from('documenti_da_processare')
    .select('created_at, oggetto_mail, file_name, mittente, metadata')
    .eq('file_url', fattura.file_url)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const fileName =
    (docRow as { file_name?: string | null } | null)?.file_name?.trim()
    || fileNameFromStorageUrl(fattura.file_url)
  const emailSubject = (docRow as { oggetto_mail?: string | null } | null)?.oggetto_mail ?? null
  const receivedAt = (docRow as { created_at?: string | null } | null)?.created_at ?? null
  const docMittente = (docRow as { mittente?: string | null } | null)?.mittente ?? null
  const docMetadata = (docRow as { metadata?: unknown } | null)?.metadata ?? null
  const fornitoreRow = fattura.fornitore as { nome?: string | null; sede_id?: string | null } | null
  const currentFornitoreNome = fornitoreRow?.nome?.trim() ?? ''
  const sedeId =
    (fattura.sede_id as string | null)?.trim()
    || fornitoreRow?.sede_id?.trim()
    || ''

  let buffer: Buffer
  let contentType: string
  try {
    const dl = await downloadStorageObjectByFileUrl(service, fattura.file_url)
    if ('error' in dl) {
      return NextResponse.json(
        { error: `Download allegato non riuscito: ${dl.error}` },
        { status: 502 },
      )
    }
    contentType = resolvedContentType(fattura.file_url, dl.contentType)
    if (contentType === 'application/octet-stream' && fattura.file_url.toLowerCase().includes('.pdf')) {
      contentType = 'application/pdf'
    }
    buffer = dl.data
  } catch (e) {
    return NextResponse.json(
      { error: `Impossibile scaricare il file: ${e instanceof Error ? e.message : 'errore'}` },
      { status: 502 },
    )
  }

  const ocrOk =
    contentType === 'application/pdf' || (typeof contentType === 'string' && contentType.startsWith('image/'))
  if (!ocrOk) {
    return NextResponse.json(
      { error: 'Formato file non riconosciuto: serve PDF o immagine (JPEG, PNG, WebP, GIF).' },
      { status: 422 },
    )
  }

  let importFromOcr: number | null = null
  let numeroFatturaFromOcr: string | null = null
  let tipoDocumentoFromOcr: string | null = null
  let ocrRagioneSociale: string | null = null
  let dateResolution: ReturnType<typeof resolveDocumentDateFromOcrContext>
  try {
    const ocr = await ocrInvoice(new Uint8Array(buffer), contentType, undefined, {
      preferVisionForPdf: true,
    })
    dateResolution = resolveDocumentDateFromOcrContext({
      ocr,
      currentDate: fattura.data,
      fileName,
      emailSubject,
      receivedAt,
    })
    if (ocr.totale_iva_inclusa != null && Number.isFinite(Number(ocr.totale_iva_inclusa))) {
      importFromOcr = Number(ocr.totale_iva_inclusa)
    }
    const rawNumero = ocr.numero_fattura?.trim()
    if (rawNumero) numeroFatturaFromOcr = rawNumero
    tipoDocumentoFromOcr = ocr.tipo_documento ?? null
    ocrRagioneSociale = ocr.ragione_sociale?.trim() ?? null
  } catch (e) {
    if (e instanceof OcrInvoiceConfigurationError) {
      return NextResponse.json({ error: e.message }, { status: 503 })
    }
    throw e
  }

  const normalized = dateResolution.proposedDate
  const dateRejected = Boolean(dateResolution.skipReason && dateResolution.skipReason !== 'unchanged')
  const dateRejectInfo = dateResolution.skipReason
    ? documentDateRejectMessage(dateResolution.skipReason, locale)
    : undefined

  // Persist the updated tipo_documento into documenti_da_processare so the UI can reflect it
  if (tipoDocumentoFromOcr && fattura.file_url) {
    const { data: docMetaRow } = await service
      .from('documenti_da_processare')
      .select('id, metadata')
      .eq('file_url', fattura.file_url)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (docMetaRow) {
      const existing = (docMetaRow.metadata ?? {}) as Record<string, unknown>
      await service
        .from('documenti_da_processare')
        .update({ metadata: { ...existing, tipo_documento: tipoDocumentoFromOcr } })
        .eq('id', docMetaRow.id)
    }
  }

  const normalizedTipo = normalizeTipoDocumento(tipoDocumentoFromOcr)
  const importNeedsFill = fattura.importo == null && importFromOcr != null
  const numeroChanged = numeroFatturaFromOcr != null && numeroFatturaFromOcr !== fattura.numero_fattura

  let fornitoreReassigned = false
  let nuovoFornitoreNome: string | null = null
  if (fattura.fornitore_id && currentFornitoreNome && sedeId) {
    const correction = await resolveFatturaFornitoreCorrection(service, {
      currentFornitoreId: fattura.fornitore_id as string,
      currentFornitoreNome,
      sedeId,
      fileName,
      emailSubject,
      metadata: docMetadata,
      ocrRagioneSociale,
      mittente: docMittente,
    })
    if (correction) {
      const reassign = await reassignEntityFornitore('fatture', {
        entityId: fatturaId,
        nuovoFornitoreId: correction.nuovoFornitoreId,
        sedeId,
        userId: user.id,
      })
      if (!reassign.error) {
        fornitoreReassigned = true
        nuovoFornitoreNome = correction.nuovoFornitoreNome
      }
    }
  }

  const fornitoreFields = {
    fornitore_reassigned: fornitoreReassigned,
    nuovo_fornitore_nome: nuovoFornitoreNome,
  }

  /** Se né data né totale né numero dall'OCR, non abbiamo nulla da scrivere nei campi fattura.
   *  Restituiamo comunque 200 con tipo_documento se l'OCR ha riclassificato il documento. */
  if (normalized == null && !importNeedsFill && !numeroChanged && !fornitoreReassigned) {
    return NextResponse.json(
      {
        ok: true,
        data: fattura.data,
        data_changed: false,
        date_rejected: dateRejected,
        ocr_date: dateResolution.ocrDate,
        importo: fattura.importo,
        importo_changed: false,
        numero_fattura: fattura.numero_fattura ?? null,
        numero_fattura_changed: false,
        tipo_documento: normalizedTipo,
        ...fornitoreFields,
        info: dateRejectInfo ?? "Nessun campo data/importo/numero aggiornato. Il tipo documento potrebbe essere stato aggiornato.",
      },
    )
  }

  if (normalized == null && !importNeedsFill && !numeroChanged && fornitoreReassigned) {
    return NextResponse.json({
      ok: true,
      data: fattura.data,
      data_changed: false,
      date_rejected: dateRejected,
      ocr_date: dateResolution.ocrDate,
      importo: fattura.importo,
      importo_changed: false,
      numero_fattura: fattura.numero_fattura ?? null,
      numero_fattura_changed: false,
      tipo_documento: normalizedTipo,
      ...fornitoreFields,
    })
  }

  const updates: { data?: string; importo?: number; numero_fattura?: string } = {}
  if (normalized != null && normalized !== fattura.data) {
    updates.data = normalized
  }
  if (importNeedsFill && importFromOcr != null) {
    updates.importo = importFromOcr
  }
  if (numeroChanged && numeroFatturaFromOcr != null) {
    updates.numero_fattura = numeroFatturaFromOcr
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({
      ok: true,
      data: fattura.data,
      data_changed: false,
      date_rejected: dateRejected,
      ocr_date: dateResolution.ocrDate,
      previous: fattura.data,
      importo: fattura.importo,
      importo_changed: false,
      numero_fattura: fattura.numero_fattura ?? null,
      numero_fattura_changed: false,
      tipo_documento: normalizedTipo,
      ...fornitoreFields,
      info: dateRejectInfo,
    })
  }

  const { error: uErr } = await service.from('fatture').update(updates).eq('id', fatturaId)

  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    data: updates.data ?? fattura.data,
    data_changed: updates.data !== undefined,
    date_rejected: dateRejected,
    ocr_date: dateResolution.ocrDate,
    previous: fattura.data,
    importo: updates.importo ?? fattura.importo ?? null,
    importo_changed: updates.importo !== undefined,
    numero_fattura: updates.numero_fattura ?? fattura.numero_fattura ?? null,
    numero_fattura_changed: updates.numero_fattura !== undefined,
    tipo_documento: normalizedTipo,
    ...fornitoreFields,
  })
}

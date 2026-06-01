import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { ocrInvoice, OcrInvoiceConfigurationError } from '@/lib/ocr-invoice'
import { fileNameFromStorageUrl, normalizeNumeroBolla } from '@/lib/fix-ocr-dates-helpers'
import {
  documentDateRejectMessage,
  resolveDocumentDateFromOcrContext,
} from '@/lib/resolve-document-date-from-ocr'
import { quantitaForBollaFromOcr } from '@/lib/bolla-quantita'
import { shouldClearBollaImportoAfterBollaDdtReocr } from '@/lib/ocr-tipo-documento'

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

  let bollaId: string
  try {
    const body = (await req.json()) as { bolla_id?: string }
    bollaId = (body.bolla_id ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
  }
  if (!bollaId) {
    return NextResponse.json({ error: 'bolla_id richiesto' }, { status: 400 })
  }

  const { data: bolla, error: qErr } = await service
    .from('bolle')
    .select('id, data, importo, numero_bolla, quantita, file_url')
    .eq('id', bollaId)
    .single()

  if (qErr || !bolla) {
    return NextResponse.json({ error: 'Bolla non trovata' }, { status: 404 })
  }
  if (!bolla.file_url?.trim()) {
    return NextResponse.json(
      { error: 'Nessun allegato: carica un file sulla bolla per poter rileggere i dati.' },
      { status: 422 },
    )
  }

  const { data: docRow } = await service
    .from('documenti_da_processare')
    .select('created_at, oggetto_mail, file_name')
    .eq('file_url', bolla.file_url)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const fileName =
    (docRow as { file_name?: string | null } | null)?.file_name?.trim()
    || fileNameFromStorageUrl(bolla.file_url)
  const emailSubject = (docRow as { oggetto_mail?: string | null } | null)?.oggetto_mail ?? null
  const receivedAt = (docRow as { created_at?: string | null } | null)?.created_at ?? null

  let buffer: Buffer
  let contentType: string
  try {
    const dl = await downloadStorageObjectByFileUrl(service, bolla.file_url)
    if ('error' in dl) {
      return NextResponse.json(
        { error: `Download allegato non riuscito: ${dl.error}` },
        { status: 502 },
      )
    }
    contentType = resolvedContentType(bolla.file_url, dl.contentType)
    if (contentType === 'application/octet-stream' && bolla.file_url.toLowerCase().includes('.pdf')) {
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

  let dateResolution: ReturnType<typeof resolveDocumentDateFromOcrContext>
  let ocrNumero: string | null = null
  let ocrQty: number | null = null
  let ocrTipo: string | null = null
  try {
    const ocr = await ocrInvoice(new Uint8Array(buffer), contentType, undefined, {
      preferVisionForPdf: true,
    })
    dateResolution = resolveDocumentDateFromOcrContext({
      ocr,
      currentDate: bolla.data,
      fileName,
      emailSubject,
      receivedAt,
    })
    const numRaw = normalizeNumeroBolla(ocr.numero_fattura) ?? ''
    ocrNumero = numRaw ? (numRaw.length > 200 ? numRaw.slice(0, 200) : numRaw) : null
    ocrQty = quantitaForBollaFromOcr(ocr)
    ocrTipo = ocr.tipo_documento ?? null
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

  const updates: {
    data?: string
    numero_bolla?: string
    quantita?: number
    importo?: number | null
  } = {}

  if (normalized != null && normalized !== bolla.data) {
    updates.data = normalized
  }
  if (ocrNumero && ocrNumero !== (bolla.numero_bolla?.trim() ?? '')) {
    updates.numero_bolla = ocrNumero
  }
  if (ocrQty != null && ocrQty !== bolla.quantita) {
    updates.quantita = ocrQty
  }
  if (shouldClearBollaImportoAfterBollaDdtReocr(ocrTipo, bolla.importo)) {
    updates.importo = null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({
      ok: true,
      data: bolla.data,
      data_changed: false,
      date_rejected: dateRejected,
      numero_bolla: bolla.numero_bolla ?? null,
      numero_bolla_changed: false,
      quantita: bolla.quantita ?? null,
      quantita_changed: false,
      info: dateRejectInfo ?? 'Nessun campo aggiornato: i dati sono già allineati al documento.',
    })
  }

  const { error: uErr } = await service.from('bolle').update(updates).eq('id', bollaId)
  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    data: updates.data ?? bolla.data,
    data_changed: updates.data !== undefined,
    date_rejected: dateRejected,
    numero_bolla: updates.numero_bolla ?? bolla.numero_bolla ?? null,
    numero_bolla_changed: updates.numero_bolla !== undefined,
    quantita: updates.quantita ?? bolla.quantita ?? null,
    quantita_changed: updates.quantita !== undefined,
    info: dateRejectInfo,
  })
}

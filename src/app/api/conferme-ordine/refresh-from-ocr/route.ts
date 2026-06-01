import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { ocrInvoice, OcrInvoiceConfigurationError } from '@/lib/ocr-invoice'
import { fileNameFromStorageUrl } from '@/lib/fix-ocr-dates-helpers'
import { resolveConfermaOrdineNumero } from '@/lib/extract-doc-type'
import { orderDateYmdFromOcr } from '@/lib/safe-date'
import { normalizeNumeroFattura } from '@/lib/fattura-duplicate-check'

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

  let confermaId: string
  try {
    const body = (await req.json()) as { conferma_id?: string }
    confermaId = (body.conferma_id ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
  }
  if (!confermaId) {
    return NextResponse.json({ error: 'conferma_id richiesto' }, { status: 400 })
  }

  const { data: row, error: qErr } = await service
    .from('conferme_ordine')
    .select('id, data_ordine, numero_ordine, titolo, file_url, file_name')
    .eq('id', confermaId)
    .single()

  if (qErr || !row) {
    return NextResponse.json({ error: 'Conferma ordine non trovata' }, { status: 404 })
  }
  if (!row.file_url?.trim()) {
    return NextResponse.json(
      { error: 'Nessun allegato collegato a questa conferma ordine.' },
      { status: 422 },
    )
  }

  const { data: docRow } = await service
    .from('documenti_da_processare')
    .select('created_at, oggetto_mail, file_name')
    .eq('file_url', row.file_url)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const fileName =
    row.file_name?.trim()
    || (docRow as { file_name?: string | null } | null)?.file_name?.trim()
    || fileNameFromStorageUrl(row.file_url)
  const emailSubject = (docRow as { oggetto_mail?: string | null } | null)?.oggetto_mail ?? null

  let buffer: Buffer
  let contentType: string
  try {
    const dl = await downloadStorageObjectByFileUrl(service, row.file_url)
    if ('error' in dl) {
      return NextResponse.json(
        { error: `Download allegato non riuscito: ${dl.error}` },
        { status: 502 },
      )
    }
    contentType = resolvedContentType(row.file_url, dl.contentType)
    if (contentType === 'application/octet-stream' && row.file_url.toLowerCase().includes('.pdf')) {
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
      { error: 'Formato file non riconosciuto: serve PDF o immagine.' },
      { status: 422 },
    )
  }

  let ocr: Awaited<ReturnType<typeof ocrInvoice>>
  try {
    ocr = await ocrInvoice(new Uint8Array(buffer), contentType, undefined, {
      preferVisionForPdf: true,
    })
  } catch (e) {
    if (e instanceof OcrInvoiceConfigurationError) {
      return NextResponse.json({ error: e.message }, { status: 503 })
    }
    throw e
  }

  const contextText = [emailSubject, fileName].filter(Boolean).join('\n')
  const proposedDate = orderDateYmdFromOcr(ocr, contextText)
  const numeroResolved = resolveConfermaOrdineNumero({
    titolo: row.titolo,
    fileName,
    numeroOrdine: row.numero_ordine,
    numeroFatturaMetadata: ocr.numero_fattura?.trim() || null,
    oggettoMail: emailSubject,
  })
  const numeroOrdine = numeroResolved ? normalizeNumeroFattura(numeroResolved) : null

  const updates: { data_ordine?: string; numero_ordine?: string; titolo?: string } = {}
  if (proposedDate && proposedDate !== row.data_ordine) {
    updates.data_ordine = proposedDate
  }
  if (numeroOrdine && numeroOrdine !== (row.numero_ordine?.trim() ?? '')) {
    updates.numero_ordine = numeroOrdine
  }
  if (numeroResolved && numeroResolved !== (row.titolo?.trim() ?? '')) {
    updates.titolo = numeroResolved
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({
      ok: true,
      data_ordine: row.data_ordine,
      data_ordine_changed: false,
      numero_ordine: row.numero_ordine ?? null,
      numero_ordine_changed: false,
      info:
        locale === 'it'
          ? 'Nessun campo aggiornato: data e numero ordine sono già allineati al documento.'
          : 'No fields updated: order date and number already match the document.',
    })
  }

  const { error: uErr } = await service.from('conferme_ordine').update(updates).eq('id', confermaId)
  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    data_ordine: updates.data_ordine ?? row.data_ordine,
    data_ordine_changed: updates.data_ordine !== undefined,
    numero_ordine: updates.numero_ordine ?? row.numero_ordine ?? null,
    numero_ordine_changed: updates.numero_ordine !== undefined,
  })
}

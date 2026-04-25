import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { ocrInvoice, OcrInvoiceConfigurationError } from '@/lib/ocr-invoice'
import { safeDate } from '@/lib/safe-date'

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
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

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

  const { data: fattura, error: qErr } = await supabase
    .from('fatture')
    .select('id, data, file_url')
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

  let buffer: Buffer
  let contentType: string
  try {
    const response = await fetch(fattura.file_url)
    if (!response.ok) {
      return NextResponse.json(
        { error: `Download allegato non riuscito (HTTP ${response.status}).` },
        { status: 502 },
      )
    }
    contentType = resolvedContentType(fattura.file_url, response.headers.get('content-type'))
    if (contentType === 'application/octet-stream' && fattura.file_url.toLowerCase().includes('.pdf')) {
      contentType = 'application/pdf'
    }
    buffer = Buffer.from(await response.arrayBuffer())
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

  let normalized: string | null
  try {
    const ocr = await ocrInvoice(new Uint8Array(buffer), contentType)
    const raw = ocr.data_fattura ?? ocr.data
    normalized = raw != null && String(raw).trim() ? safeDate(String(raw)) : null
  } catch (e) {
    if (e instanceof OcrInvoiceConfigurationError) {
      return NextResponse.json({ error: e.message }, { status: 503 })
    }
    throw e
  }

  if (!normalized) {
    return NextResponse.json(
      { error: 'Data del documento non riconosciuta dal file. Prova a sostituire l’allegato o inserisci la data a mano.' },
      { status: 422 },
    )
  }

  if (normalized === fattura.data) {
    return NextResponse.json({
      ok: true,
      data: normalized,
      data_changed: false,
      previous: fattura.data,
    })
  }

  const { error: uErr } = await supabase
    .from('fatture')
    .update({ data: normalized })
    .eq('id', fatturaId)

  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    data: normalized,
    data_changed: true,
    previous: fattura.data,
  })
}

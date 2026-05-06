import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { ocrInvoice, OcrInvoiceConfigurationError } from '@/lib/ocr-invoice'
import { safeDate } from '@/lib/safe-date'
import { normalizeNumeroFattura } from '@/lib/fattura-duplicate-check'

export const dynamic = 'force-dynamic'

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

function centsEq(a: number | null | undefined, b: number | null | undefined): boolean {
  const na = a != null ? Number(a) : null
  const nb = b != null ? Number(b) : null
  if (na == null || nb == null || !Number.isFinite(na) || !Number.isFinite(nb)) return na === nb
  return Math.round(na * 100) === Math.round(nb * 100)
}

function numEq(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeNumeroFattura(a).toLowerCase() === normalizeNumeroFattura(b).toLowerCase()
}

type PreviewRead = {
  data: string | null
  importo: number | null
  numero_fattura: string | null
  ragione_sociale: string | null
  tipo_documento: string | null
  importo_raw: string | null
}

/**
 * Anteprima OCR dal file allegato (`preview`) o applicazione valori confermati (`apply`).
 * Non modifica il DB in fase preview.
 */
export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    fattura_id?: string
    phase?: 'preview' | 'apply'
    updates?: { data?: string | null; importo?: number | null; numero_fattura?: string | null }
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const fatturaId = body.fattura_id?.trim()
  if (!fatturaId) return NextResponse.json({ error: 'fattura_id richiesto' }, { status: 400 })

  const phase = body.phase === 'apply' ? 'apply' : 'preview'
  const service = createServiceClient()

  const { data: fattura, error: qErr } = await service
    .from('fatture')
    .select('id, data, importo, numero_fattura, file_url')
    .eq('id', fatturaId)
    .single()

  if (qErr || !fattura) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })
  if (!fattura.file_url?.trim()) {
    return NextResponse.json({ error: 'Nessun allegato da analizzare.' }, { status: 422 })
  }

  if (phase === 'apply') {
    const u = body.updates ?? {}
    const payload: Record<string, unknown> = {}
    if (typeof u.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(u.data.trim())) {
      const v = safeDate(u.data.trim())
      if (v) payload.data = v
    }
    if (u.importo !== undefined && u.importo !== null && Number.isFinite(Number(u.importo))) {
      payload.importo = Number(u.importo)
    }
    if (u.numero_fattura !== undefined) {
      const raw = u.numero_fattura
      payload.numero_fattura =
        raw === null || raw === '' ? null : normalizeNumeroFattura(String(raw)) || null
    }
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'Nessun campo da aggiornare.' }, { status: 400 })
    }
    const { error: uErr } = await service.from('fatture').update(payload).eq('id', fatturaId)
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
    return NextResponse.json({ ok: true as const, applied: payload })
  }

  let buffer: Buffer
  let contentType: string
  try {
    const dl = await downloadStorageObjectByFileUrl(service, fattura.file_url)
    if ('error' in dl) {
      return NextResponse.json({ error: `Download allegato non riuscito: ${dl.error}` }, { status: 502 })
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
      { error: 'Formato non supportato per OCR: serve PDF o immagine.' },
      { status: 422 },
    )
  }

  let ocr: Awaited<ReturnType<typeof ocrInvoice>>
  try {
    ocr = await ocrInvoice(new Uint8Array(buffer), contentType)
  } catch (e) {
    if (e instanceof OcrInvoiceConfigurationError) {
      return NextResponse.json({ error: e.message }, { status: 503 })
    }
    throw e
  }

  const rawDate = ocr.data_fattura ?? ocr.data
  const dataNorm =
    rawDate != null && String(rawDate).trim() ? safeDate(String(rawDate)) : null
  const importoVal =
    ocr.totale_iva_inclusa != null && Number.isFinite(Number(ocr.totale_iva_inclusa))
      ? Number(ocr.totale_iva_inclusa)
      : null
  const numNorm =
    ocr.numero_fattura != null && String(ocr.numero_fattura).trim()
      ? normalizeNumeroFattura(String(ocr.numero_fattura)) || null
      : null

  const read: PreviewRead = {
    data: dataNorm,
    importo: importoVal,
    numero_fattura: numNorm,
    ragione_sociale: ocr.ragione_sociale ?? ocr.nome ?? null,
    tipo_documento: ocr.tipo_documento ?? null,
    importo_raw: ocr.importo_raw ?? null,
  }

  const current = {
    data: String(fattura.data ?? '').slice(0, 10),
    importo: fattura.importo != null ? Number(fattura.importo) : null,
    numero_fattura: fattura.numero_fattura != null ? normalizeNumeroFattura(String(fattura.numero_fattura)) : null,
  }

  const hasAnyRead = Boolean(read.data || read.importo != null || read.numero_fattura)
  if (!hasAnyRead) {
    return NextResponse.json(
      {
        error:
          'Dal file non sono stati ricavati data, importo o numero documento. Prova un PDF più leggibile o correggi a mano dalla scheda.',
      },
      { status: 422 },
    )
  }

  const diff = {
    data: read.data != null && read.data !== current.data,
    importo: read.importo != null && !centsEq(read.importo, current.importo),
    numero_fattura:
      read.numero_fattura != null && !numEq(read.numero_fattura, current.numero_fattura),
  }

  return NextResponse.json({
    ok: true as const,
    current,
    read,
    diff,
    hasChanges: diff.data || diff.importo || diff.numero_fattura,
  })
}

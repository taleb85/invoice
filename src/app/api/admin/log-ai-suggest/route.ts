import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { ocrInvoice, OcrInvoiceConfigurationError } from '@/lib/ocr-invoice'

/**
 * Admin: rianalizza l'allegato di un log (OCR) per precompilare anagrafica fornitore.
 */
export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo amministratori' }, { status: 403 })
  }

  let body: { logId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const logId = body.logId?.trim()
  if (!logId) return NextResponse.json({ error: 'logId richiesto' }, { status: 400 })

  const service = createServiceClient()
  const { data: log, error } = await service.from('log_sincronizzazione').select('*').eq('id', logId).maybeSingle()
  if (error || !log) return NextResponse.json({ error: 'Log non trovato' }, { status: 404 })

  const fileUrl = log.file_url as string | null
  if (!fileUrl?.trim()) {
    return NextResponse.json({ error: 'Nessun file associato al log' }, { status: 400 })
  }

  try {
    const res = await fetch(fileUrl)
    if (!res.ok) {
      return NextResponse.json({ error: `Download file fallito (${res.status})` }, { status: 502 })
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const ct = res.headers.get('content-type') || 'application/octet-stream'
    const ocr = await ocrInvoice(buf, ct, undefined, {})
    const nome = (ocr.ragione_sociale ?? ocr.nome)?.trim() || null
    const piva = (ocr.p_iva ?? ocr.piva)?.trim() || null
    const mittente = String(log.mittente ?? '').trim().toLowerCase()

    return NextResponse.json({
      nome,
      piva,
      email: mittente.includes('@') ? mittente : null,
      sede_id: (log.sede_id as string | null) ?? null,
      mittente,
    })
  } catch (e) {
    if (e instanceof OcrInvoiceConfigurationError) {
      return NextResponse.json({ error: e.message }, { status: 503 })
    }
    const msg = e instanceof Error ? e.message : 'Errore OCR'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

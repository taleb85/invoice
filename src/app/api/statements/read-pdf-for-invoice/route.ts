/**
 * POST /api/statements/read-pdf-for-invoice
 *
 * Per la modale "Crea anche fattura" sulla scheda Verifica: scarica il PDF dello
 * statement, esegue OCR fattura e ritorna { numero_fattura, importo, data } da
 * usare come pre-fill della modale.
 *
 * Differenze rispetto a /api/fatture/ocr-sync-document:
 *  - lavora su `statement_id`, non su una fattura esistente
 *  - non scrive nulla nel DB (è solo una lettura "preview")
 *  - autorizzazione identica a /api/statements/register-also-as-invoice
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
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

export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const master = isMasterAdminRole(profile.role)
  const privileged = isSedePrivilegedRole(profile.role)
  if (!master && !privileged) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  let body: { statement_id?: string }
  try {
    body = (await req.json()) as { statement_id?: string }
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const statementId = body.statement_id?.trim()
  if (!statementId) return NextResponse.json({ error: 'statement_id richiesto' }, { status: 400 })

  const service = createServiceClient()

  const { data: stmt, error: stmtErr } = await service
    .from('statements')
    .select('id, sede_id, file_url')
    .eq('id', statementId)
    .maybeSingle()

  if (stmtErr) return NextResponse.json({ error: stmtErr.message }, { status: 500 })
  if (!stmt) return NextResponse.json({ error: 'Statement non trovato' }, { status: 404 })
  if (!stmt.file_url) return NextResponse.json({ error: 'Lo statement non ha un file allegato' }, { status: 400 })

  if (!master && profile.sede_id) {
    const stmtSede = stmt.sede_id as string | null
    if (stmtSede && stmtSede !== profile.sede_id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }
  }

  let buffer: Buffer
  let contentType: string
  try {
    const dl = await downloadStorageObjectByFileUrl(service, stmt.file_url as string)
    if ('error' in dl) {
      return NextResponse.json({ error: `Download allegato non riuscito: ${dl.error}` }, { status: 502 })
    }
    contentType = resolvedContentType(stmt.file_url as string, dl.contentType)
    if (contentType === 'application/octet-stream' && (stmt.file_url as string).toLowerCase().includes('.pdf')) {
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
    return NextResponse.json(
      { error: `Errore OCR: ${e instanceof Error ? e.message : 'sconosciuto'}` },
      { status: 500 },
    )
  }

  const rawDate = ocr.data_fattura ?? ocr.data
  const data =
    rawDate != null && String(rawDate).trim() ? safeDate(String(rawDate)) : null
  const importo =
    ocr.totale_iva_inclusa != null && Number.isFinite(Number(ocr.totale_iva_inclusa))
      ? Number(ocr.totale_iva_inclusa)
      : null
  const numero_fattura =
    ocr.numero_fattura != null && String(ocr.numero_fattura).trim()
      ? normalizeNumeroFattura(String(ocr.numero_fattura)) || null
      : null

  const hasAny = Boolean(data || importo != null || numero_fattura)

  return NextResponse.json({
    ok: true as const,
    hasAny,
    read: {
      numero_fattura,
      importo,
      data,
      ragione_sociale: ocr.ragione_sociale ?? ocr.nome ?? null,
      importo_raw: ocr.importo_raw ?? null,
    },
  })
}

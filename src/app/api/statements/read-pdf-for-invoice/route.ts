/**
 * POST /api/statements/read-pdf-for-invoice
 *
 * Per la modale "Crea anche fattura" sulla scheda Verifica: il PDF di un
 * estratto conto può ANCHE essere la fattura riepilogativa del periodo
 * (Eden Springs UK, Brakes, alcuni fornitori di forniture). Per pre-compilare
 * la modale dobbiamo estrarre due valori che spesso NON compaiono come
 * "Invoice No." / "Total" classici:
 *  - numero fattura → di solito Account No. / Statement No. / Issued date
 *  - importo totale  → somma di tutte le righe statement
 *
 * Strategia (priorità decrescente, fallback automatici):
 *  1. OCR fattura sul PDF (`ocrInvoice`) — può trovare numero/totale espliciti
 *     quando presenti come "Invoice No." e "Total inc VAT".
 *  2. Fallback al "documentHeader" già OCR-ato dall'`ocrStatement` originale
 *     (`statements.extracted_pdf_dates.account_no` / `issued_date`).
 *  3. Fallback al totale calcolato come somma di `statement_rows.importo`.
 *
 * Non scrive nulla: pure read/preview. Autorizzazione identica a
 * /api/statements/register-also-as-invoice.
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

/** I sorgenti distinguono "Invoice No. 12345" da "fallback: usato Account No. perché il PDF è uno statement-fattura". */
type PrefillSource = 'ocr' | 'statement_header' | 'statement_rows_sum' | null

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

  type StmtRow = {
    id: string
    sede_id: string | null
    file_url: string | null
    document_date: string | null
    extracted_pdf_dates: Record<string, unknown> | null
  }

  const { data: stmt, error: stmtErr } = await service
    .from('statements')
    .select('id, sede_id, file_url, document_date, extracted_pdf_dates')
    .eq('id', statementId)
    .maybeSingle()

  if (stmtErr) return NextResponse.json({ error: stmtErr.message }, { status: 500 })
  if (!stmt) return NextResponse.json({ error: 'Statement non trovato' }, { status: 404 })
  const stmtRow = stmt as unknown as StmtRow
  if (!stmtRow.file_url) return NextResponse.json({ error: 'Lo statement non ha un file allegato' }, { status: 400 })

  if (!master && profile.sede_id) {
    const stmtSede = stmtRow.sede_id
    if (stmtSede && stmtSede !== profile.sede_id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }
  }

  // ── Sorgente 2 (in parallelo al download): estratto_pdf_dates già salvato a tempo di ingest ──
  const header = (stmtRow.extracted_pdf_dates ?? {}) as Record<string, unknown>
  const headerAccountNo =
    typeof header.account_no === 'string' && header.account_no.trim() ? header.account_no.trim() : null
  const headerIssuedDate =
    typeof header.issued_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(header.issued_date)
      ? (header.issued_date as string)
      : null

  // ── Sorgente 3 (in parallelo): somma delle righe statement come totale calcolato ──
  const rowsSumPromise = service
    .from('statement_rows')
    .select('importo')
    .eq('statement_id', statementId)
    .then(({ data, error }) => {
      if (error || !data) return null
      let sum = 0
      let count = 0
      for (const r of data as Array<{ importo: number | null }>) {
        const n = r?.importo != null ? Number(r.importo) : null
        if (n != null && Number.isFinite(n)) {
          sum += n
          count++
        }
      }
      return count > 0 ? Math.round(sum * 100) / 100 : null
    })

  // ── Download PDF + OCR fattura (sorgente 1) ──
  let buffer: Buffer
  let contentType: string
  try {
    const dl = await downloadStorageObjectByFileUrl(service, stmtRow.file_url)
    if ('error' in dl) {
      return NextResponse.json({ error: `Download allegato non riuscito: ${dl.error}` }, { status: 502 })
    }
    contentType = resolvedContentType(stmtRow.file_url, dl.contentType)
    if (contentType === 'application/octet-stream' && stmtRow.file_url.toLowerCase().includes('.pdf')) {
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

  let ocrNumero: string | null = null
  let ocrImporto: number | null = null
  let ocrData: string | null = null
  let ragioneSociale: string | null = null
  try {
    const ocr = await ocrInvoice(new Uint8Array(buffer), contentType)
    const rawDate = ocr.data_fattura ?? ocr.data
    ocrData = rawDate != null && String(rawDate).trim() ? safeDate(String(rawDate)) : null
    ocrImporto =
      ocr.totale_iva_inclusa != null && Number.isFinite(Number(ocr.totale_iva_inclusa))
        ? Number(ocr.totale_iva_inclusa)
        : null
    ocrNumero =
      ocr.numero_fattura != null && String(ocr.numero_fattura).trim()
        ? normalizeNumeroFattura(String(ocr.numero_fattura)) || null
        : null
    ragioneSociale = ocr.ragione_sociale ?? ocr.nome ?? null
  } catch (e) {
    // OCR fattura su un PDF che è "ufficialmente" uno statement: spesso il modello
    // restituisce poco o niente. Lasciamo i campi a null e procediamo con fallback —
    // non è un errore bloccante per la modale.
    if (e instanceof OcrInvoiceConfigurationError) {
      return NextResponse.json({ error: e.message }, { status: 503 })
    }
    // Log silenzioso: i fallback sotto possono comunque pre-compilare la modale.
    console.warn('[read-pdf-for-invoice] OCR fattura fallito, uso fallback header/rows:', e instanceof Error ? e.message : e)
  }

  const rowsSum = await rowsSumPromise

  /* ── Merge: prefer OCR, fallback su header statement + somma righe ── */
  let numero_fattura: string | null = ocrNumero
  let numeroSource: PrefillSource = ocrNumero ? 'ocr' : null
  if (!numero_fattura && headerAccountNo) {
    numero_fattura = normalizeNumeroFattura(headerAccountNo) || headerAccountNo
    numeroSource = 'statement_header'
  }

  let importo: number | null = ocrImporto
  let importoSource: PrefillSource = ocrImporto != null ? 'ocr' : null
  if (importo == null && rowsSum != null) {
    importo = rowsSum
    importoSource = 'statement_rows_sum'
  }

  const data =
    ocrData ??
    (typeof stmtRow.document_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(stmtRow.document_date)
      ? stmtRow.document_date
      : headerIssuedDate)

  const hasAny = Boolean(numero_fattura || importo != null || data)

  return NextResponse.json({
    ok: true as const,
    hasAny,
    read: {
      numero_fattura,
      importo,
      data,
      ragione_sociale: ragioneSociale,
    },
    sources: {
      numero: numeroSource,
      importo: importoSource,
    },
  })
}

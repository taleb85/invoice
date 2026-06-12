import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { geminiGenerateText, geminiGenerateVision } from '@/lib/gemini-vision'

export interface LineItem {
  prodotto: string
  codice_prodotto: string | null
  prezzo: number
  quantita: number | null
  importo_linea: number | null
  unita: string | null
  note: string | null
}

const SYSTEM_PROMPT = `You are a supplier document line-item extractor. Given an invoice, delivery note (bolla/DDT), or similar document, extract ALL product/service line items with their unit prices.

Return ONLY valid JSON — no markdown, no explanation:
{
  "items": [
    {
      "codice_prodotto": "SKU / article code / item # / EAN — or null if the line has no separate product code column",
      "prodotto": "Product name / description exactly as written (without repeating the code if it is only in the code column)",
      "prezzo": 12.50,
      "quantita": 2,
      "importo_linea": 25.00,
      "unita": "X6 / kg / box — pack format or unit label, NOT the order quantity unless that is the only qty on the line",
      "note": "any useful detail (e.g. 'per 5kg case') or null"
    }
  ],
  "data_fattura": "YYYY-MM-DD or null"
}

Rules:
- Extract the UNIT PRICE (prezzo unitario), NOT the line total.
- On many UK catering invoices the rightmost money column is **Value** = **line total** (qty × unit). Example: Qty 2, Value 17.98 → quantita=2, importo_linea=17.98, prezzo=8.99 (17.98÷2). NOT prezzo=17.98.
- NEVER use the quantity column (Qty, Qtà) as prezzo.
- NEVER put the Value/Amount column into prezzo without dividing by Quantity.
- Pack Size (X6, X400, ROLL, 12x45) goes in the "unita" field only — it is NOT order quantity.
- If only line totals are available and there's a quantity, calculate: line_total / quantity.
- Always fill quantita (ordered cases/units on the invoice line) and importo_linea (line total / amount column) when visible.
- Example: 2 cases at £12.50 each → quantita = 2, importo_linea = 25.00, prezzo = 12.50 — NOT prezzo = 25.00.
- Example: 6 cases at £7.61 each → quantita = 6, importo_linea = 45.66, prezzo = 7.61.
- Pack format like "X6" (6 items per case) is unita, not quantita — quantita is how many cases were ordered.
- One invoice row = one JSON item; do not merge two product codes into one line (e.g. CFB128E and CF14BE are two lines).
- For wholesale food/drink, case prices are often £10–£200; values under £1 on a line that also shows a much larger line total are usually quantity or per-kg, not the case price — prefer line_total/qty or the price in the dedicated price column.
- Include ALL product line items visible on the document.
- Do NOT include delivery instructions, time windows ("Delivery from 9-12"), phone numbers, "drop" / "handball drop" / "case drop based on sales orders", carriage, surcharges, or other non-product text — only real SKUs / goods / beverages / food.
- Normalise prices to plain decimal numbers (e.g. "£12,50" → 12.50, "1.234,56" → 1234.56).
- If price is not parseable, use null for that item.
- codice_prodotto: use the value from columns often named Code, SKU, Art., Artikel, Ref., Item #, Product ID, EAN, Cod., Cód., etc. If the document only embeds a code inside the description text and there is no separate code field, you may put that alphanumeric code here and shorten prodotto accordingly, or leave codice_prodotto null if unclear.
- prodotto: use the original language as written on the invoice; prefer the description text over the code.
- If no line items can be extracted, return { "items": [], "data_fattura": null }.`

import { extractPdfText } from '@/lib/pdf-parse-utils'
import { isNonProductListinoRow, cleanListinoProductNameForGrouping } from '@/lib/listino-display'
import {
  existingListinoPricesForImport,
  inferCodiceFromProductName,
  mergeImportLinesWithPdfText,
  normalizeListinoImportLineItem,
  parseInvoiceTableLinesFromText,
  type ListinoImportLineInput,
} from '@/lib/listino-invoice-line-normalize'

function toLineItem(row: ListinoImportLineInput): LineItem {
  return {
    prodotto: row.prodotto,
    codice_prodotto: row.codice_prodotto ?? null,
    prezzo: row.prezzo,
    quantita: row.quantita ?? null,
    importo_linea: row.importo_linea ?? null,
    unita: row.unita ?? null,
    note: row.note ?? null,
  }
}

function parseOptionalPositiveNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function parseLineItems(raw: string): { items: LineItem[]; data_fattura: string | null } {
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return { items: [], data_fattura: null }
    const parsed = JSON.parse(match[0])
    const items: LineItem[] = (parsed.items ?? [])
      .filter((i: Record<string, unknown>) => i.prodotto && i.prezzo != null)
      .map((i: Record<string, unknown>) => {
        const rawCode = i.codice_prodotto ?? i.codice ?? i.sku
        const codice =
          rawCode != null && String(rawCode).trim() !== '' ? String(rawCode).trim() : null
        // Strip trailing punctuation (`.`, `,`, `:`, `;`, `-`) per evitare
        // che lo stesso prodotto venga raggruppato in 2 serie distinte
        // (`Beer Menabrea Blonde` vs `Beer Menabrea Blonde.`).
        const prodottoNorm = cleanListinoProductNameForGrouping(
          String(i.prodotto)
            .trim()
            .replace(/[\s.,;:\-]+$/, ''),
        )
        const prezzoRaw =
          typeof i.prezzo === 'number' ? i.prezzo : parseFloat(String(i.prezzo)) || 0
        const quantitaRaw = parseOptionalPositiveNumber(i.quantita ?? i.qty ?? i.quantity)
        const importoLineaRaw = parseOptionalPositiveNumber(
          i.importo_linea ?? i.line_total ?? i.totale_riga,
        )
        const codiceResolved = codice ?? inferCodiceFromProductName(prodottoNorm)
        const raw: LineItem = {
          prodotto: prodottoNorm,
          codice_prodotto: codiceResolved,
          prezzo: prezzoRaw,
          quantita: quantitaRaw,
          importo_linea: importoLineaRaw,
          unita: i.unita ? String(i.unita) : null,
          note: i.note ? String(i.note) : null,
        }
        return raw
      })
    return { items, data_fattura: parsed.data_fattura ?? null }
  } catch {
    return { items: [], data_fattura: null }
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY non configurata.' }, { status: 503 })
  }

  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })


  const body = (await req.json()) as {
    fattura_id?: string
    bolla_id?: string
    conferma_ordine_id?: string
  }
  const fatturaId = body.fattura_id?.trim()
  const bollaId = body.bolla_id?.trim()
  const ordineId = body.conferma_ordine_id?.trim()
  const idCount = [fatturaId, bollaId, ordineId].filter(Boolean).length
  if (idCount !== 1) {
    return NextResponse.json(
      { error: 'Specificare esattamente uno tra fattura_id, bolla_id, conferma_ordine_id' },
      { status: 400 },
    )
  }

  const service = createServiceClient()

  let fileUrl: string | null
  let docData: string
  let fornitoreId: string
  let docRef: string | null
  const documentoTipo: 'fattura' | 'bolla' | 'ordine' = fatturaId
    ? 'fattura'
    : bollaId
      ? 'bolla'
      : 'ordine'

  if (fatturaId) {
    const { data: fattura, error: fatturaErr } = await service
      .from('fatture')
      .select('id, file_url, data, numero_fattura, fornitore_id')
      .eq('id', fatturaId)
      .single()

    if (fatturaErr || !fattura) {
      return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })
    }
    if (!fattura.file_url) {
      return NextResponse.json({ error: 'Questa fattura non ha un file allegato.' }, { status: 422 })
    }
    fileUrl = fattura.file_url
    docData = fattura.data
    fornitoreId = fattura.fornitore_id
    docRef = fattura.numero_fattura
  } else if (bollaId) {
    const { data: bolla, error: bollaErr } = await service
      .from('bolle')
      .select('id, file_url, data, numero_bolla, fornitore_id')
      .eq('id', bollaId)
      .single()

    if (bollaErr || !bolla) {
      return NextResponse.json({ error: 'Bolla non trovata' }, { status: 404 })
    }
    if (!bolla.file_url) {
      return NextResponse.json({ error: 'Questa bolla non ha un file allegato.' }, { status: 422 })
    }
    fileUrl = bolla.file_url
    docData = bolla.data
    fornitoreId = bolla.fornitore_id
    docRef = bolla.numero_bolla
  } else {
    const { data: ordine, error: ordineErr } = await service
      .from('conferme_ordine')
      .select('id, file_url, data_ordine, created_at, numero_ordine, titolo, fornitore_id')
      .eq('id', ordineId!)
      .single()

    if (ordineErr || !ordine) {
      return NextResponse.json({ error: 'Conferma ordine non trovata' }, { status: 404 })
    }
    if (!ordine.file_url) {
      return NextResponse.json({ error: 'Questo ordine non ha un file allegato.' }, { status: 422 })
    }
    fileUrl = ordine.file_url
    const dataOrdine = ordine.data_ordine as string | null
    docData =
      dataOrdine?.slice(0, 10) ??
      String(ordine.created_at ?? '').slice(0, 10) ??
      new Date().toISOString().split('T')[0]
    fornitoreId = ordine.fornitore_id
    docRef =
      (ordine.numero_ordine as string | null)?.trim() ||
      (ordine.titolo as string | null)?.trim() ||
      null
  }

  if (!fileUrl) {
    return NextResponse.json({ error: 'Documento senza file allegato.' }, { status: 422 })
  }

  // Download the file
  let fileBuffer: Buffer
  let contentType: string

  try {
    const dl = await downloadStorageObjectByFileUrl(service, fileUrl)
    if ('error' in dl) throw new Error(dl.error)
    contentType = dl.contentType || 'application/octet-stream'
    fileBuffer = dl.data
  } catch (err) {
    return NextResponse.json({ error: `Impossibile scaricare il file: ${String(err)}` }, { status: 502 })
  }

  let rawResponse: string
  let pdfText: string | null = null

  if (contentType.includes('pdf')) {
    const text = await extractPdfText(fileBuffer)
    pdfText = text || null
    if (text) {
      try {
        const res = await geminiGenerateText(SYSTEM_PROMPT, text.slice(0, 6000), 1500)
        rawResponse = res.text
      } catch (err) {
        console.error('[listino] Gemini error on PDF testo:', err)
        return NextResponse.json({ error: 'Errore estrazione testo PDF.' }, { status: 500 })
      }
    } else {
      // Scanned PDF — send directly to Gemini vision
      try {
        const base64 = fileBuffer.toString('base64')
        const res = await geminiGenerateVision(
          SYSTEM_PROMPT,
          'application/pdf',
          base64,
          SYSTEM_PROMPT,
          1500,
        )
        rawResponse = res.text
      } catch (err) {
        console.error('[listino] Gemini vision error on scanned PDF:', err)
        return NextResponse.json(
          {
            error:
              'PDF senza testo estraibile e lettura grafica non riuscita. Il file potrebbe essere protetto, corrotto o in un formato non supportato.',
          },
          { status: 422 },
        )
      }
    }
  } else {
    try {
      const base64 = fileBuffer.toString('base64')
      const res = await geminiGenerateVision(SYSTEM_PROMPT, contentType, base64, SYSTEM_PROMPT, 1500)
      rawResponse = res.text
    } catch (err) {
      console.error('[listino] Gemini vision error on image:', err)
      return NextResponse.json({ error: 'Errore lettura immagine.' }, { status: 500 })
    }
  }

  const parsed = parseLineItems(rawResponse)
  const data_fattura = parsed.data_fattura
  let items = parsed.items

  if (pdfText) {
    const textLines = parseInvoiceTableLinesFromText(pdfText)
    items = mergeImportLinesWithPdfText(items as ListinoImportLineInput[], textLines).map(toLineItem)
  }

  const { data: listinoRows } = await service
    .from('listino_prezzi')
    .select('prodotto, prezzo, note')
    .eq('fornitore_id', fornitoreId)

  const listinoForHist = (listinoRows ?? []) as Array<{
    prodotto: string
    prezzo: number
    note?: string | null
  }>

  items = items
    .map((item) =>
      toLineItem(
        normalizeListinoImportLineItem(
          item,
          existingListinoPricesForImport(
            listinoForHist,
            item.prodotto,
            item.codice_prodotto,
          ),
        ),
      ),
    )
    .filter((item) => !isNonProductListinoRow({ prodotto: item.prodotto, note: item.note }))

  return NextResponse.json({
    items,
    data_fattura: data_fattura ?? docData ?? new Date().toISOString().split('T')[0],
    fattura_ref: documentoTipo === 'fattura' ? docRef : null,
    bolla_ref: documentoTipo === 'bolla' ? docRef : null,
    ordine_ref: documentoTipo === 'ordine' ? docRef : null,
    documento_tipo: documentoTipo,
  })
}

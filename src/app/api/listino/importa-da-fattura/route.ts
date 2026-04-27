import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { geminiGenerateText, geminiGenerateVision } from '@/lib/gemini-vision'

export interface LineItem {
  prodotto: string
  codice_prodotto: string | null
  prezzo: number
  unita: string | null
  note: string | null
}

const SYSTEM_PROMPT = `You are an invoice line-item extractor. Given an invoice document, extract ALL product/service line items with their unit prices.

Return ONLY valid JSON — no markdown, no explanation:
{
  "items": [
    {
      "codice_prodotto": "SKU / article code / item # / EAN — or null if the line has no separate product code column",
      "prodotto": "Product name / description exactly as written (without repeating the code if it is only in the code column)",
      "prezzo": 12.50,
      "unita": "kg / unit / box / l / pz — or null if not specified",
      "note": "any useful detail (e.g. 'per 5kg case') or null"
    }
  ],
  "data_fattura": "YYYY-MM-DD or null"
}

Rules:
- Extract the UNIT PRICE (prezzo unitario / unit price / prix unitaire / Einzelpreis), NOT the line total.
- If only line totals are available and there's a quantity, calculate: line_total / quantity.
- Include ALL line items visible on the document.
- Normalise prices to plain decimal numbers (e.g. "£12,50" → 12.50, "1.234,56" → 1234.56).
- If price is not parseable, use null for that item.
- codice_prodotto: use the value from columns often named Code, SKU, Art., Artikel, Ref., Item #, Product ID, EAN, Cod., Cód., etc. If the document only embeds a code inside the description text and there is no separate code field, you may put that alphanumeric code here and shorten prodotto accordingly, or leave codice_prodotto null if unclear.
- prodotto: use the original language as written on the invoice; prefer the description text over the code.
- If no line items can be extracted, return { "items": [], "data_fattura": null }.`

async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = (await import('pdf-parse')) as any
    const pdfParse = mod.default ?? mod
    const result = await pdfParse(buffer)
    return result.text?.trim() || null
  } catch {
    return null
  }
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
        return {
          prodotto: String(i.prodotto).trim(),
          codice_prodotto: codice,
          prezzo: typeof i.prezzo === 'number' ? i.prezzo : parseFloat(String(i.prezzo)) || 0,
          unita: i.unita ? String(i.unita) : null,
          note: i.note ? String(i.note) : null,
        }
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

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { fattura_id } = await req.json() as { fattura_id: string }
  if (!fattura_id) return NextResponse.json({ error: 'fattura_id richiesto' }, { status: 400 })

  const service = createServiceClient()

  // Load the fattura record
  const { data: fattura, error: fatturaErr } = await service
    .from('fatture')
    .select('id, file_url, data, numero_fattura')
    .eq('id', fattura_id)
    .single()

  if (fatturaErr || !fattura) {
    return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })
  }

  if (!fattura.file_url) {
    return NextResponse.json({ error: 'Questa fattura non ha un file allegato.' }, { status: 422 })
  }

  // Download the file
  let fileBuffer: Buffer
  let contentType: string

  try {
    const dl = await downloadStorageObjectByFileUrl(service, fattura.file_url)
    if ('error' in dl) throw new Error(dl.error)
    contentType = dl.contentType || 'application/octet-stream'
    fileBuffer = dl.data
  } catch (err) {
    return NextResponse.json({ error: `Impossibile scaricare il file: ${String(err)}` }, { status: 502 })
  }

  let rawResponse: string

  if (contentType.includes('pdf')) {
    const text = await extractPdfText(fileBuffer)
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

  const { items, data_fattura } = parseLineItems(rawResponse)

  const { error: analErr } = await service
    .from('fatture')
    .update({ analizzata: true })
    .eq('id', fattura_id)
  if (analErr) {
    const msg = analErr.message ?? ''
    if (!msg.includes('analizzata') && !msg.includes('42703')) {
      console.warn('[listino/importa-da-fattura] aggiornamento analizzata:', msg)
    }
  }

  return NextResponse.json({
    items,
    data_fattura: data_fattura ?? fattura.data ?? new Date().toISOString().split('T')[0],
    fattura_ref: fattura.numero_fattura,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import OpenAI from 'openai'

export interface LineItem {
  prodotto: string
  prezzo: number
  unita: string | null
  note: string | null
}

const SYSTEM_PROMPT = `You are an invoice line-item extractor. Given an invoice document, extract ALL product/service line items with their unit prices.

Return ONLY valid JSON — no markdown, no explanation:
{
  "items": [
    {
      "prodotto": "Product name / description exactly as written",
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
- prodotto: use the original language as written on the invoice.
- If no line items can be extracted, return { "items": [], "data_fattura": null }.`

async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import('pdf-parse') as any
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
      .map((i: Record<string, unknown>) => ({
        prodotto: String(i.prodotto).trim(),
        prezzo: typeof i.prezzo === 'number' ? i.prezzo : parseFloat(String(i.prezzo)) || 0,
        unita: i.unita ? String(i.unita) : null,
        note: i.note ? String(i.note) : null,
      }))
    return { items, data_fattura: parsed.data_fattura ?? null }
  } catch {
    return { items: [], data_fattura: null }
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY non configurata.' }, { status: 503 })
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
    const response = await fetch(fattura.file_url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    contentType = response.headers.get('content-type') ?? 'application/octet-stream'
    fileBuffer = Buffer.from(await response.arrayBuffer())
  } catch (err) {
    return NextResponse.json({ error: `Impossibile scaricare il file: ${String(err)}` }, { status: 502 })
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  let rawResponse: string

  if (contentType.includes('pdf')) {
    const text = await extractPdfText(fileBuffer)
    if (!text) {
      return NextResponse.json({ error: 'PDF senza testo estraibile. Prova con un\'immagine.' }, { status: 422 })
    }
    const snippet = text.slice(0, 6000)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1500,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: snippet },
      ],
    })
    rawResponse = completion.choices[0]?.message?.content ?? ''
  } else {
    const base64   = fileBuffer.toString('base64')
    const imageUrl = `data:${contentType};base64,${base64}`
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1500,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          { type: 'text', text: SYSTEM_PROMPT },
        ],
      }],
    })
    rawResponse = completion.choices[0]?.message?.content ?? ''
  }

  const { items, data_fattura } = parseLineItems(rawResponse)
  return NextResponse.json({
    items,
    data_fattura: data_fattura ?? fattura.data ?? new Date().toISOString().split('T')[0],
    fattura_ref: fattura.numero_fattura,
  })
}

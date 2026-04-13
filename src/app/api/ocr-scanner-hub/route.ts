import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { ocrInvoice, OcrInvoiceConfigurationError } from '@/lib/ocr-invoice'

export type ScannerDocumentKind = 'ddt' | 'fattura' | 'supplier_card' | 'unknown'

export type ScannerIntent = 'auto' | 'bolla' | 'fattura' | 'nuovo_fornitore'

type HubJson = {
  document_kind: ScannerDocumentKind
  nome: string | null
  piva: string | null
  indirizzo: string | null
  data: string | null
  numero_documento: string | null
  importo: number | null
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

function isImageType(mime: string): boolean {
  return (IMAGE_TYPES as readonly string[]).includes(mime)
}

function parseJsonContent(content: string): Record<string, unknown> {
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned) as Record<string, unknown>
}

function normalizeDate(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : v
}

function mapKind(v: unknown): ScannerDocumentKind {
  const s = String(v ?? '').toLowerCase()
  if (s === 'ddt' || s === 'bolla' || s === 'delivery') return 'ddt'
  if (s === 'fattura' || s === 'invoice') return 'fattura'
  if (s === 'supplier_card' || s === 'anagrafica' || s === 'supplier') return 'supplier_card'
  return 'unknown'
}

async function ocrBollaImage(openai: OpenAI, imageUrl: string): Promise<Pick<HubJson, 'nome' | 'piva' | 'indirizzo' | 'data'>> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
        {
          type: 'text',
          text: `Documento commerciale (bolla/DDT o simile). Estrai:
1. FORNITORE (mittente/cedente, NON destinatario)
2. Partita IVA fornitore (senza prefisso IT)
3. Data documento YYYY-MM-DD

Solo JSON: {"nome":string|null,"piva":string|null,"indirizzo":string|null,"data":string|null}`,
        },
      ],
    }],
  })
  const parsed = parseJsonContent(response.choices[0]?.message?.content ?? '')
  return {
    nome: typeof parsed.nome === 'string' ? parsed.nome : null,
    piva: typeof parsed.piva === 'string' ? parsed.piva : null,
    indirizzo: typeof parsed.indirizzo === 'string' ? parsed.indirizzo : null,
    data: normalizeDate(parsed.data),
  }
}

async function classifyAndExtractImage(openai: OpenAI, imageUrl: string): Promise<HubJson> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 350,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
        {
          type: 'text',
          text: `Analizza il documento commerciale italiano/europeo.

Classifica document_kind:
- "ddt" = documento di trasporto, bolla di consegna, DDT, packing list con spedizione
- "fattura" = fattura fiscale, invoice con imponibile/IVA/totale
- "supplier_card" = solo intestazione/anagrafica fornitore, contratto senza dettaglio fattura o DDT
- "unknown" = non chiaro

Estrai sempre dal CEDENTE/MITTENTE (non dal cliente):
nome (ragione sociale), piva (solo numeri, no IT), data (YYYY-MM-DD se visibile),
numero_documento (numero bolla o fattura se presente), importo (numero totale documento se è fattura o DDT con totale, altrimenti null),
indirizzo (indirizzo fornitore in una riga se visibile, altrimenti null).

Solo JSON valido:
{"document_kind":"ddt"|"fattura"|"supplier_card"|"unknown","nome":string|null,"piva":string|null,"indirizzo":string|null,"data":string|null,"numero_documento":string|null,"importo":number|null}`,
        },
      ],
    }],
  })
  const parsed = parseJsonContent(response.choices[0]?.message?.content ?? '')
  const importoRaw = parsed.importo
  const importo = typeof importoRaw === 'number' && !isNaN(importoRaw) ? importoRaw : null
  return {
    document_kind: mapKind(parsed.document_kind),
    nome: typeof parsed.nome === 'string' ? parsed.nome : null,
    piva: typeof parsed.piva === 'string' ? parsed.piva : null,
    indirizzo: typeof parsed.indirizzo === 'string' ? parsed.indirizzo : null,
    data: normalizeDate(parsed.data),
    numero_documento: typeof parsed.numero_documento === 'string' ? parsed.numero_documento : null,
    importo,
  }
}

async function classifyFromInvoiceText(openai: OpenAI, textSnippet: string): Promise<ScannerDocumentKind> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 80,
    temperature: 0,
    messages: [{
      role: 'user',
      content: `Testo estratto da un PDF aziendale. Classifica UNA parola tra: ddt, fattura, supplier_card, unknown
- ddt se è documento di trasporto / bolla / DDT
- fattura se è fattura o nota di credito fiscale
- supplier_card se è solo presentazione/lettera senza dettaglio fiscale completo
- unknown se non determinabile

Solo JSON: {"document_kind":"ddt"|"fattura"|"supplier_card"|"unknown"}

Testo (troncato):
${textSnippet.slice(0, 6000)}`,
    }],
  })
  try {
    const parsed = parseJsonContent(response.choices[0]?.message?.content ?? '')
    return mapKind(parsed.document_kind)
  } catch {
    return 'unknown'
  }
}

function invoiceToHub(kind: ScannerDocumentKind, inv: Awaited<ReturnType<typeof ocrInvoice>>): HubJson {
  return {
    document_kind: kind,
    nome: inv.nome,
    piva: inv.piva,
    indirizzo: inv.indirizzo ?? null,
    data: inv.data,
    numero_documento: inv.numero_fattura,
    importo: inv.totale_iva_inclusa,
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY non configurata.' }, { status: 503 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const intentRaw = (formData.get('intent') as string | null) ?? 'auto'
    const intent = (['auto', 'bolla', 'fattura', 'nuovo_fornitore'].includes(intentRaw) ? intentRaw : 'auto') as ScannerIntent

    if (!file) {
      return NextResponse.json({ error: 'Nessun file ricevuto.' }, { status: 400 })
    }

    if (!isImageType(file.type) && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Formato non supportato. Usa JPG, PNG, WebP, GIF o PDF.' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const buf = new Uint8Array(buffer)
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    if (intent === 'nuovo_fornitore') {
      const inv = await ocrInvoice(buf, file.type)
      return NextResponse.json({
        intent,
        ...invoiceToHub('supplier_card', inv),
      })
    }

    if (intent === 'fattura') {
      const inv = await ocrInvoice(buf, file.type)
      return NextResponse.json({
        intent,
        ...invoiceToHub('fattura', inv),
      })
    }

    if (intent === 'bolla') {
      if (isImageType(file.type)) {
        const base64 = Buffer.from(buffer).toString('base64')
        const imageUrl = `data:${file.type};base64,${base64}`
        const part = await ocrBollaImage(openai, imageUrl)
        return NextResponse.json({
          intent,
          document_kind: 'ddt' as const,
          nome: part.nome,
          piva: part.piva,
          indirizzo: part.indirizzo,
          data: part.data,
          numero_documento: null,
          importo: null,
        })
      }
      const inv = await ocrInvoice(buf, file.type)
      return NextResponse.json({
        intent,
        ...invoiceToHub('ddt', inv),
      })
    }

    // intent === 'auto'
    if (isImageType(file.type)) {
      const base64 = Buffer.from(buffer).toString('base64')
      const imageUrl = `data:${file.type};base64,${base64}`
      const hub = await classifyAndExtractImage(openai, imageUrl)
      return NextResponse.json({ intent, ...hub })
    }

    // PDF auto
    const inv = await ocrInvoice(buf, file.type)
    let textForKind = ''
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = await import('pdf-parse') as any
      const pdfParse = mod.default ?? mod
      const pdfBuf = Buffer.from(buffer)
      const result = await pdfParse(pdfBuf)
      textForKind = (result.text ?? '').trim()
    } catch {
      textForKind = [inv.nome, inv.numero_fattura, inv.piva].filter(Boolean).join(' ')
    }
    const kind = textForKind.length > 40
      ? await classifyFromInvoiceText(openai, textForKind)
      : 'unknown'
    const resolvedKind: ScannerDocumentKind =
      kind === 'unknown' && (inv.numero_fattura || inv.totale_iva_inclusa != null) ? 'fattura' : kind === 'unknown' ? 'fattura' : kind

    return NextResponse.json({
      intent,
      ...invoiceToHub(resolvedKind, inv),
    })
  } catch (err: unknown) {
    if (err instanceof OcrInvoiceConfigurationError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    const message = err instanceof Error ? err.message : 'Errore sconosciuto'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

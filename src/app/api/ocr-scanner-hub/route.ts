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

function parseJsonContent(content: string): Record<string, unknown> {
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned) as Record<string, unknown>
}

function mapKind(v: unknown): ScannerDocumentKind {
  const s = String(v ?? '').toLowerCase()
  if (s === 'ddt' || s === 'bolla' || s === 'delivery') return 'ddt'
  if (s === 'fattura' || s === 'invoice') return 'fattura'
  if (s === 'supplier_card' || s === 'anagrafica' || s === 'supplier') return 'supplier_card'
  return 'unknown'
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

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Carica un PDF (fattura, bolla o estratto da mail). Le foto non sono supportate.' },
        { status: 400 },
      )
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
      const inv = await ocrInvoice(buf, file.type)
      return NextResponse.json({
        intent,
        ...invoiceToHub('ddt', inv),
      })
    }

    // intent === 'auto'
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

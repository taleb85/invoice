import { NextRequest, NextResponse } from 'next/server'
import { ocrInvoice, OcrInvoiceConfigurationError } from '@/lib/ocr-invoice'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nessun file ricevuto.' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Carica un PDF (fattura o documento da mail). Le immagini non sono supportate.' },
        { status: 400 },
      )
    }

    const buffer = await file.arrayBuffer()
    const result = await ocrInvoice(new Uint8Array(buffer), file.type)

    if (!result.nome && !result.data) {
      return NextResponse.json({ error: 'Impossibile estrarre dati dal documento.' }, { status: 422 })
    }

    return NextResponse.json({
      nome: result.nome,
      piva: result.piva,
      email: null,
      data: result.data,
    })
  } catch (err: unknown) {
    if (err instanceof OcrInvoiceConfigurationError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    const message = err instanceof Error ? err.message : 'Errore sconosciuto'
    return NextResponse.json({ error: `Errore OCR: ${message}` }, { status: 500 })
  }
}

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
        { error: 'Carica un PDF (bolla/DDT). Le immagini non sono supportate.' },
        { status: 400 },
      )
    }

    const buffer = await file.arrayBuffer()
    const result = await ocrInvoice(new Uint8Array(buffer), file.type)

    return NextResponse.json({
      nome: result.nome,
      piva: result.piva,
      data: result.data,
    })
  } catch (err: unknown) {
    if (err instanceof OcrInvoiceConfigurationError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    const message = err instanceof Error ? err.message : 'Errore sconosciuto'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

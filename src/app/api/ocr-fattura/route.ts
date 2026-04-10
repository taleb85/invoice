import { NextRequest, NextResponse } from 'next/server'
import { ocrInvoice } from '@/lib/ocr-invoice'

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY non configurata.' }, { status: 503 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nessun file ricevuto.' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Formato non supportato. Usa JPG, PNG, WebP, GIF o PDF.' }, { status: 400 })
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
    const message = err instanceof Error ? err.message : 'Errore sconosciuto'
    return NextResponse.json({ error: `Errore OCR: ${message}` }, { status: 500 })
  }
}

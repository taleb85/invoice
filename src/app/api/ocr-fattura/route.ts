import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

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

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Formato non supportato. Usa JPG, PNG, WebP o GIF. Per i PDF, scatta uno screenshot della fattura.' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = file.type
    const imageUrl = `data:${mimeType};base64,${base64}`

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: imageUrl, detail: 'low' },
          },
          {
            type: 'text',
            text: `Analizza questa fattura ed estrai i dati del FORNITORE (chi emette la fattura, non il destinatario).
Rispondi SOLO con JSON valido, senza markdown:
{"nome":"Ragione sociale","piva":"P.IVA senza prefisso paese o null","email":"email o null"}`,
          },
        ],
      }],
    })

    const content = response.choices[0]?.message?.content ?? ''
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const data = JSON.parse(cleaned)

    return NextResponse.json({
      nome: data.nome ?? null,
      piva: data.piva ?? null,
      email: data.email ?? null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto'
    return NextResponse.json({ error: `Errore OCR: ${message}` }, { status: 500 })
  }
}

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
      return NextResponse.json({ error: 'Formato non supportato.' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const imageUrl = `data:${file.type};base64,${base64}`

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: imageUrl, detail: 'low' },
          },
          {
            type: 'text',
            text: `Questa è una bolla di consegna o documento di trasporto. Estrai:
1. Il FORNITORE (mittente/cedente, NON il destinatario/acquirente)
2. La DATA del documento (data di emissione/consegna visibile sul documento)

Rispondi SOLO con JSON valido, senza markdown o testo aggiuntivo:
{"nome":"Ragione sociale del fornitore o null","piva":"Partita IVA senza prefisso IT o null","data":"Data in formato YYYY-MM-DD o null"}`,
          },
        ],
      }],
    })

    const content = response.choices[0]?.message?.content ?? ''
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    // Valida che la data estratta sia un formato YYYY-MM-DD plausibile
    let dataDoc: string | null = null
    if (parsed.data && /^\d{4}-\d{2}-\d{2}$/.test(parsed.data)) {
      const d = new Date(parsed.data)
      if (!isNaN(d.getTime())) dataDoc = parsed.data
    }

    return NextResponse.json({
      nome: parsed.nome ?? null,
      piva: parsed.piva ?? null,
      data: dataDoc,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

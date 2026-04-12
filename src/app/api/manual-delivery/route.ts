/**
 * POST /api/manual-delivery
 * - JSON: { text?: string, fornitoreId: string, sedeId?: string | null, languageHint?: string }
 * - multipart/form-data: text?, fornitoreId, sedeId?, languageHint?, file? (image)
 * Serve almeno testo non vuoto oppure un'immagine. Salva su statements + statement_rows.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import { saveManualDigitalReceipt } from '@/lib/manual-delivery'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

export async function POST(req: NextRequest) {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const ct = req.headers.get('content-type') ?? ''
  let text = ''
  let fornitoreId = ''
  let sedeIdRaw: string | null | undefined
  let languageHint: string | undefined
  let imageBase64: string | undefined
  let imageMimeType: string | undefined

  if (ct.includes('multipart/form-data')) {
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Form non valido.' }, { status: 400 })
    }
    const t = form.get('text')
    text = typeof t === 'string' ? t.trim() : ''
    const fid = form.get('fornitoreId')
    fornitoreId = typeof fid === 'string' ? fid.trim() : ''
    const sid = form.get('sedeId')
    if (sid === null || sid === '') sedeIdRaw = null
    else if (typeof sid === 'string') sedeIdRaw = sid.trim() || null
    else sedeIdRaw = undefined
    const lh = form.get('languageHint')
    languageHint = typeof lh === 'string' && lh.trim() ? lh.trim() : undefined

    const file = form.get('file')
    if (file instanceof File && file.size > 0) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
        return NextResponse.json({ error: 'Formato immagine non supportato.' }, { status: 400 })
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: 'File troppo grande (max 10 MB).' }, { status: 400 })
      }
      const buffer = await file.arrayBuffer()
      imageBase64 = Buffer.from(buffer).toString('base64')
      imageMimeType = file.type
    }
  } else {
    let body: {
      text?: string
      fornitoreId?: string
      sedeId?: string | null
      languageHint?: string
    }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
    }
    text = typeof body.text === 'string' ? body.text.trim() : ''
    fornitoreId = typeof body.fornitoreId === 'string' ? body.fornitoreId.trim() : ''
    sedeIdRaw = body.sedeId
    languageHint =
      typeof body.languageHint === 'string' && body.languageHint.trim()
        ? body.languageHint.trim()
        : undefined
  }

  if (!fornitoreId) {
    return NextResponse.json({ error: 'Campo "fornitoreId" obbligatorio.' }, { status: 400 })
  }
  if (!text && !imageBase64) {
    return NextResponse.json(
      { error: 'Inserisci una descrizione o allega una foto.' },
      { status: 400 },
    )
  }

  const supabase = createServiceClient()

  const { data: forn, error: fornErr } = await supabase
    .from('fornitori')
    .select('id')
    .eq('id', fornitoreId)
    .maybeSingle()
  if (fornErr || !forn) {
    return NextResponse.json({ error: 'Fornitore non trovato.' }, { status: 404 })
  }

  const sedeId =
    sedeIdRaw === undefined || sedeIdRaw === null || sedeIdRaw === ''
      ? null
      : String(sedeIdRaw).trim() || null

  const result = await saveManualDigitalReceipt(supabase, {
    fornitoreId,
    sedeId,
    userText: text,
    languageHint,
    imageBase64,
    imageMimeType,
  })

  if (!result.ok) {
    const status =
      result.code === 'NO_API_KEY'
        ? 503
        : result.code === 'PARSE_EMPTY'
          ? 422
          : 500
    return NextResponse.json({ error: result.error, code: result.code }, { status })
  }

  return NextResponse.json({
    statementId: result.statementId,
    summary: result.summary,
    rows: result.manualLines.length,
  })
}

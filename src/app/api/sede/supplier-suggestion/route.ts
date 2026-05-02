import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { fetchSedeSupplierSuggestion } from '@/lib/suggested-fornitore'
import {
  SUPPLIER_HINT_SKIP_COOKIE,
  SUPPLIER_HINT_SKIP_COOKIE_OPTS,
  pushSupplierHintSkip,
  serializeSupplierHintSkipCookie,
} from '@/lib/supplier-hint-dismiss-cookie'

/**
 * registra salt documento nei cookie così anche la server component esclude questo ID al refresh.
 */
export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { sede_id?: string; document_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const sedeId = body.sede_id?.trim()
  const documentId = body.document_id?.trim()
  if (!sedeId || !documentId) {
    return NextResponse.json({ error: 'sede_id e document_id richiesti' }, { status: 400 })
  }

  const store = await cookies()
  const prev = store.get(SUPPLIER_HINT_SKIP_COOKIE)?.value
  const nextBlob = pushSupplierHintSkip(prev, sedeId, documentId)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SUPPLIER_HINT_SKIP_COOKIE, serializeSupplierHintSkipCookie(nextBlob), SUPPLIER_HINT_SKIP_COOKIE_OPTS)
  return res
}

/**
 * Stesso suggerimento fornitore della dashboard, con lista documenti saltati (solo GET — client prefetch).
 */
export async function GET(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sedeId = req.nextUrl.searchParams.get('sede_id')?.trim()
  if (!sedeId) {
    return NextResponse.json({ error: 'sede_id richiesta' }, { status: 400 })
  }

  const excludeRaw = req.nextUrl.searchParams.get('exclude')?.trim() ?? ''
  const excludeDocumentIds = excludeRaw
    ? [...new Set(excludeRaw.split(',').map((s) => s.trim()).filter(Boolean))]
    : []

  try {
    const supabase = createServiceClient()
    const suggestion = await fetchSedeSupplierSuggestion(supabase, sedeId, { excludeDocumentIds })
    return NextResponse.json({ suggestion })
  } catch (e) {
    console.error('[supplier-suggestion GET]', e)
    return NextResponse.json({ error: 'Errore' }, { status: 500 })
  }
}

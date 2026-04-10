import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'

// ── POST /api/fornitori ────────────────────────────────────────────────────────
// Creates a new fornitore for a given sede and registers its email in
// fornitore_emails so the IMAP scan can recognise it automatically.

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await req.json() as {
    nome?: string
    piva?: string
    email?: string
    sede_id?: string
  }

  const nome    = body.nome?.trim()
  const piva    = body.piva?.trim().replace(/\D/g, '') || null
  const email   = body.email?.trim().toLowerCase() || null
  const sede_id = body.sede_id ?? null

  if (!nome) {
    return NextResponse.json({ error: 'La Ragione Sociale è obbligatoria' }, { status: 400 })
  }
  if (!sede_id) {
    return NextResponse.json({ error: 'La Sede è obbligatoria' }, { status: 400 })
  }

  const service = createServiceClient()

  // 1. Insert the fornitore record
  const { data: fornitore, error: fornitoreErr } = await service
    .from('fornitori')
    .insert({ nome, piva, email, sede_id })
    .select('id, nome, piva, email, sede_id, created_at')
    .single()

  if (fornitoreErr || !fornitore) {
    return NextResponse.json({ error: fornitoreErr?.message ?? 'Errore nel salvataggio' }, { status: 500 })
  }

  // 2. Register email in fornitore_emails for IMAP matching (ignore errors — non-blocking)
  if (email) {
    await service.from('fornitore_emails').insert({
      fornitore_id: fornitore.id,
      email,
    })
  }

  return NextResponse.json({ fornitore }, { status: 201 })
}

// ── DELETE /api/fornitori ──────────────────────────────────────────────────────
// Deletes a fornitore by id (also removes related fornitore_emails rows via DB cascade
// if configured, otherwise we clean them up manually).

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID mancante' }, { status: 400 })

  const service = createServiceClient()

  // Remove email aliases first (avoid FK constraint if no cascade)
  await service.from('fornitore_emails').delete().eq('fornitore_id', id)

  const { error } = await service.from('fornitori').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

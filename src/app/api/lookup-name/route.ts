import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { name } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Nome obbligatorio.' }, { status: 400 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Cerca per full_name, case-insensitive, con sede associata
  const { data, error } = await adminClient
    .from('profiles')
    .select('email, full_name, role, sedi(nome)')
    .ilike('full_name', name.trim())
    .limit(2)

  if (error) {
    return NextResponse.json({ error: 'Errore del server.' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Nessun utente trovato con questo nome.' }, { status: 404 })
  }
  if (data.length > 1) {
    return NextResponse.json({ error: 'Più utenti con lo stesso nome. Contatta l\'amministratore.' }, { status: 409 })
  }

  const profile = data[0]
  const sede = Array.isArray(profile.sedi) ? profile.sedi[0] : profile.sedi as { nome: string } | null

  return NextResponse.json({
    email: profile.email,
    sede_nome: sede?.nome ?? null,
  })
}

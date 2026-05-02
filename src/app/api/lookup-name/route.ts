import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'
import {
  normalizeOperatorLoginName,
  profileFirstTokenEquals,
} from '@/lib/operator-login-name'

export async function POST(req: NextRequest) {
  const { name } = await req.json()
  const token = normalizeOperatorLoginName(typeof name === 'string' ? name : '')
  if (!token) {
    return NextResponse.json({ error: 'Nome obbligatorio.' }, { status: 400 })
  }
  const adminClient = createServiceClient()

  // Nessun ILIKE sul prefisso: con nomi accentati (es. José) non matcherebbe "JOSE%".
  // Carichiamo un bound ragionevole di profili e filtriamo in app con diacritici piegati.
  const { data: rows, error } = await adminClient
    .from('profiles')
    .select('email, full_name, role, sedi(nome)')
    .limit(2000)

  if (error) {
    return NextResponse.json({ error: 'Errore del server.' }, { status: 500 })
  }
  const data = (rows ?? []).filter(p => profileFirstTokenEquals(p.full_name, token))

  if (data.length === 0) {
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

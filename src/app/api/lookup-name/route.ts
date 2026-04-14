import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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
  /* `%` e `_` sono wildcard in ILIKE: togliamoli dal pattern per evitare match errati / errori. */
  const likePrefix = token.replace(/[%_\\]/g, '')
  if (!likePrefix) {
    return NextResponse.json({ error: 'Nome obbligatorio.' }, { status: 400 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Prima parola del nome (come in login), prefisso su full_name poi filtro rigoroso
  const { data: rows, error } = await adminClient
    .from('profiles')
    .select('email, full_name, role, sedi(nome)')
    .ilike('full_name', `${likePrefix}%`)
    .limit(50)

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

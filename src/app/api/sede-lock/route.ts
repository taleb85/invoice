import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/** GET: restituisce nome e presence di access_password per la sede dell'utente */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('sede_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ redirect: '/' })
  if (profile.role === 'admin') return NextResponse.json({ redirect: '/' })
  if (!profile.sede_id) return NextResponse.json({ redirect: '/' })

  const { data: sede } = await supabase
    .from('sedi')
    .select('nome, access_password')
    .eq('id', profile.sede_id)
    .single()

  if (!sede?.access_password) return NextResponse.json({ redirect: '/' })

  return NextResponse.json({
    sede_id: profile.sede_id,
    sede_nome: sede.nome,
    has_password: true,
  })
}

/** POST: verifica il codice inserito dall'operatore */
export async function POST(req: NextRequest) {
  const { code } = await req.json()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('sede_id')
    .eq('id', user.id)
    .single()

  if (!profile?.sede_id) return NextResponse.json({ error: 'Sede non trovata' }, { status: 404 })

  const { data: sede } = await supabase
    .from('sedi')
    .select('access_password')
    .eq('id', profile.sede_id)
    .single()

  if (sede?.access_password !== code) {
    return NextResponse.json({ error: 'Codice non corretto. Riprova.' }, { status: 401 })
  }

  return NextResponse.json({ sede_id: profile.sede_id, ok: true })
}

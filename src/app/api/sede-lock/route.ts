import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'

function normalizeAccessCode(value: unknown): string {
  return String(value ?? '').trim()
}

function serviceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key)
}

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

  const svc = serviceDb()
  const { data: sede, error } = svc
    ? await svc.from('sedi').select('nome, access_password').eq('id', profile.sede_id).single()
    : await supabase.from('sedi').select('nome, access_password').eq('id', profile.sede_id).single()

  if (error || !sede) return NextResponse.json({ redirect: '/' })

  const stored = normalizeAccessCode(sede.access_password)
  if (!stored) return NextResponse.json({ redirect: '/' })

  return NextResponse.json({
    sede_id: profile.sede_id,
    sede_nome: sede.nome,
    has_password: true,
  })
}

/** POST: verifica il codice inserito dall'operatore */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const entered = normalizeAccessCode(body?.code)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('sede_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.sede_id) return NextResponse.json({ error: 'Sede non trovata' }, { status: 404 })
  if (profile.role === 'admin') {
    return NextResponse.json({ sede_id: profile.sede_id, ok: true })
  }

  if (!entered) {
    return NextResponse.json({ error: 'Inserisci il codice di accesso.' }, { status: 400 })
  }

  const svc = serviceDb()
  const { data: sede, error } = svc
    ? await svc.from('sedi').select('access_password').eq('id', profile.sede_id).single()
    : await supabase.from('sedi').select('access_password').eq('id', profile.sede_id).single()

  if (error || !sede) {
    return NextResponse.json({ error: 'Sede non trovata.' }, { status: 404 })
  }

  const stored = normalizeAccessCode(sede.access_password)
  if (!stored || stored !== entered) {
    return NextResponse.json({ error: 'Codice non corretto. Riprova.' }, { status: 401 })
  }

  return NextResponse.json({ sede_id: profile.sede_id, ok: true })
}

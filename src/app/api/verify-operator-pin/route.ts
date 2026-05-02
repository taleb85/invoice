import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import {
  normalizeOperatorLoginName,
  profileFirstTokenEquals,
} from '@/lib/operator-login-name'
import { isProfilesBranchDeskRole } from '@/lib/roles'

/**
 * Verifica PIN su GoTrue senza cookie: ok per “admin verifica operatore” (sessioni diverse).
 * Per “operatore verifica sé stesso” NON usare: un nuovo grant invalida il refresh token in uso nel browser.
 */
async function passwordMatchesSupabaseUser(email: string, password: string): Promise<boolean> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const res = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({ email, password }),
  })
  return res.ok
}

export async function POST(req: NextRequest) {
  const { name, pin } = await req.json()

  const token = normalizeOperatorLoginName(typeof name === 'string' ? name : '')
  if (!token || !pin) {
    return NextResponse.json({ error: 'Nome e PIN obbligatori.' }, { status: 400 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: rows, error: lookupErr } = await adminClient
    .from('profiles')
    .select('id, email, full_name, role, sede_id, sedi(nome)')
    .limit(2000)

  if (lookupErr) {
    return NextResponse.json({ error: 'Errore del server.' }, { status: 500 })
  }
  const profiles = (rows ?? []).filter(p => profileFirstTokenEquals(p.full_name, token))

  if (profiles.length === 0) {
    return NextResponse.json({ error: 'Operatore non trovato.' }, { status: 404 })
  }
  if (profiles.length > 1) {
    return NextResponse.json({ error: 'Nome ambiguo. Contatta l\'amministratore.' }, { status: 409 })
  }

  const profile = profiles[0]

  const pr = typeof profile.role === 'string' ? profile.role : ''
  if (!isProfilesBranchDeskRole(pr)) {
    return NextResponse.json(
      { error: 'Questo account non è un operatore, un responsabile di sede o un amministratore tecnico.' },
      { status: 403 },
    )
  }

  const sede = Array.isArray(profile.sedi)
    ? (profile.sedi[0] as { nome: string } | null)
    : (profile.sedi as { nome: string } | null)

  const payload = {
    id:        profile.id,
    full_name: profile.full_name,
    sede_id:   profile.sede_id,
    sede_nome: sede?.nome ?? null,
    role:      pr.toLowerCase() as 'operatore' | 'admin_sede' | 'admin_tecnico',
  }

  const out = NextResponse.json(payload)

  const supabaseSession = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name: cookieName, value, options }) => {
            out.cookies.set(cookieName, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabaseSession.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato.' }, { status: 401 })
  }

  const pinStr = String(pin)

  if (user.id === profile.id) {
    const { error: signInErr } = await supabaseSession.auth.signInWithPassword({
      email:    profile.email,
      password: pinStr,
    })
    if (signInErr) {
      return NextResponse.json({ error: 'PIN non corretto.' }, { status: 401 })
    }
    return out
  }

  const ok = await passwordMatchesSupabaseUser(profile.email, pinStr)
  if (!ok) {
    return NextResponse.json({ error: 'PIN non corretto.' }, { status: 401 })
  }
  return out
}

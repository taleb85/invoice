import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accesso negato.' }, { status: 403 })

  const { name, pin, sedeId, role } = await req.json()

  if (!name?.trim() || !pin || !sedeId) {
    return NextResponse.json({ error: 'Nome, PIN e sede sono obbligatori.' }, { status: 400 })
  }
  if (String(pin).length < 4) {
    return NextResponse.json({ error: 'Il PIN deve essere di almeno 4 caratteri.' }, { status: 400 })
  }

  // Email interna auto-generata (l'operatore non la usa mai)
  const slug = name.trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')
  const rand = Math.random().toString(36).slice(2, 7)
  const internalEmail = `${slug}_${rand}@interno.fluxo`

  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
    email: internalEmail,
    password: String(pin),
    email_confirm: true,
    user_metadata: { full_name: name.trim(), display_name: name.trim() },
  })

  if (createErr) {
    return NextResponse.json({ error: `Errore nella creazione: ${createErr.message}` }, { status: 400 })
  }

  const { error: profileErr } = await adminClient
    .from('profiles')
    .update({ sede_id: sedeId, role: role ?? 'operatore', full_name: name.trim() })
    .eq('id', newUser.user!.id)

  if (profileErr) {
    return NextResponse.json({ error: `Operatore creato ma errore nel profilo: ${profileErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ message: `Operatore "${name.trim()}" creato con successo.` })
}

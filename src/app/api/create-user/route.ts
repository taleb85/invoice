import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  // Solo admin può creare utenti
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accesso negato.' }, { status: 403 })

  const { email, password, sedeId, role } = await req.json()
  if (!email || !password || !sedeId) {
    return NextResponse.json({ error: 'Email, password e sede sono obbligatori.' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'La password deve essere di almeno 6 caratteri.' }, { status: 400 })
  }

  // Crea utente con service role key (bypass email confirmation)
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createErr) {
    const msg = createErr.message.includes('already')
      ? 'Esiste già un account con questa email.'
      : `Errore: ${createErr.message}`
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Aggiorna profilo con sede e ruolo
  const { error: profileErr } = await adminClient
    .from('profiles')
    .update({ sede_id: sedeId, role: role ?? 'operatore' })
    .eq('id', newUser.user!.id)

  if (profileErr) {
    return NextResponse.json({ error: `Utente creato ma errore nel profilo: ${profileErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ message: `Operatore ${email} creato e assegnato alla sede.` })
}

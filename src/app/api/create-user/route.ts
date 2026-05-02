import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { isCorporateSedeAdminRole, isMasterAdminRole } from '@/lib/roles'
import { logActivity } from '@/lib/activity-logger'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, sede_id').eq('id', user.id).single()
  const master = isMasterAdminRole(profile?.role)
  const sedeAdmin = isCorporateSedeAdminRole(profile?.role)
  if (!master && !sedeAdmin) return NextResponse.json({ error: 'Accesso negato.' }, { status: 403 })

  const { name, pin, sedeId, role } = await req.json()

  const displayName = typeof name === 'string' ? name.trim().toUpperCase() : ''
  if (!displayName || !pin || !sedeId) {
    return NextResponse.json({ error: 'Nome, PIN e sede sono obbligatori.' }, { status: 400 })
  }

  if (sedeAdmin) {
    if (!profile?.sede_id || sedeId !== profile.sede_id) {
      return NextResponse.json({ error: 'Puoi creare operatori solo per la tua sede.' }, { status: 403 })
    }
    if ((role ?? 'operatore') !== 'operatore') {
      return NextResponse.json({ error: 'Solo il ruolo operatore può essere assegnato.' }, { status: 403 })
    }
  }
  if (String(pin).length < 4) {
    return NextResponse.json({ error: 'Il PIN deve essere di almeno 4 caratteri.' }, { status: 400 })
  }

  // Email interna auto-generata (l'operatore non la usa mai)
  const slug = displayName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')
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
    user_metadata: { full_name: displayName, display_name: displayName },
  })

  if (createErr) {
    return NextResponse.json({ error: `Errore nella creazione: ${createErr.message}` }, { status: 400 })
  }

  const { error: profileErr } = await adminClient
    .from('profiles')
    .update({ sede_id: sedeId, role: role ?? 'operatore', full_name: displayName })
    .eq('id', newUser.user!.id)

  if (profileErr) {
    return NextResponse.json({ error: `Operatore creato ma errore nel profilo: ${profileErr.message}` }, { status: 500 })
  }

  logActivity(adminClient as Parameters<typeof logActivity>[0], {
    userId: user.id,
    sedeId: sedeId as string,
    action: 'operatore.created',
    entityType: 'operatore',
    entityId: newUser.user!.id,
    entityLabel: displayName,
  }).catch(() => {})

  return NextResponse.json({ message: `Operatore "${displayName}" creato con successo.` })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { isCorporateSedeAdminRole, isMasterAdminRole } from '@/lib/roles'

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, sede_id').eq('id', user.id).single()
  const master = isMasterAdminRole(profile?.role)
  const corporateSede = isCorporateSedeAdminRole(profile?.role)
  if (!master && !corporateSede) return NextResponse.json({ error: 'Accesso negato.' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId obbligatorio.' }, { status: 400 })

  // Impedisci auto-eliminazione
  if (userId === user.id) return NextResponse.json({ error: 'Non puoi eliminare il tuo account.' }, { status: 400 })

  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (corporateSede) {
    const { data: target } = await adminClient
      .from('profiles')
      .select('sede_id, role')
      .eq('id', userId)
      .maybeSingle()
    const tr = String(target?.role ?? '').toLowerCase()
    if (!target?.sede_id || target.sede_id !== profile?.sede_id) {
      return NextResponse.json({ error: 'Puoi eliminare solo utenti della tua sede.' }, { status: 403 })
    }
    if (tr === 'admin' || tr === 'admin_sede' || tr === 'admin_tecnico') {
      return NextResponse.json({ error: 'Non puoi eliminare questo profilo.' }, { status: 403 })
    }
  }

  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ message: 'Utente eliminato.' })
}

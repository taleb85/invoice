import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import { isAdminSedeRole, isMasterAdminRole } from '@/lib/roles'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!isMasterAdminRole(profile?.role)) {
    return NextResponse.json({ error: 'Solo l\'admin può creare sedi' }, { status: 403 })
  }

  const body = await req.json() as {
    nome?: string
    country_code?: string
    currency?: string
    timezone?: string
  }

  const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
  if (!nome) return NextResponse.json({ error: 'Nome sede obbligatorio' }, { status: 400 })

  const validCountries = ['UK', 'IT', 'FR', 'DE', 'ES', 'GB']
  const country_code = validCountries.includes(body.country_code ?? '') ? body.country_code! : 'IT'
  const currency = body.currency ?? 'EUR'
  const timezone = body.timezone ?? 'Europe/Rome'

  const svc = createServiceClient()
  const { data: sede, error } = await svc
    .from('sedi')
    .insert([{ nome, country_code, currency, timezone }])
    .select('id, nome')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, sede })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, sede_id')
    .eq('id', user.id)
    .single()

  const master = isMasterAdminRole(profile?.role)
  const sedeAdmin = isAdminSedeRole(profile?.role)
  if (!master && !sedeAdmin) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }
  if (sedeAdmin && !profile?.sede_id?.trim()) {
    return NextResponse.json({ error: 'Profilo sede non configurato.' }, { status: 403 })
  }

  const scopedSedeId = sedeAdmin
    ? profile!.sede_id!.trim()
    : (profile?.sede_id?.trim() || null)
  /** `global` = admin master senza sede; `sede` = vista limitata a una filiale. */
  const adminListScope: 'global' | 'sede' = scopedSedeId ? 'sede' : 'global'

  /** RLS non espone l’elenco profili della sede agli admin_sede: usiamo service role dopo aver verificato il chiamante. */
  const svc = createServiceClient()

  const { data: sediRaw, error } = await svc
    .from('sedi')
    .select('*')
    .order('nome')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sedi =
    scopedSedeId ? (sediRaw ?? []).filter((s) => s.id === scopedSedeId) : (sediRaw ?? [])

  // Conta per ogni sede — solo dati configurativi (no operativi come bolle/fatture)
  const sediWithCounts = await Promise.all(
    sedi.map(async (sede) => {
      const [{ count: fornitori_count }, { count: users_count }] =
        await Promise.all([
          svc.from('fornitori').select('*', { count: 'exact', head: true }).eq('sede_id', sede.id),
          svc
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('sede_id', sede.id)
            .neq('role', 'admin'),
        ])
      return {
        ...sede,
        fornitori_count: fornitori_count ?? 0,
        users_count: users_count ?? 0,
      }
    })
  )

  const { data: profilesRaw } = await svc
    .from('profiles')
    .select('*, sedi(id, nome, created_at)')
    .order('email')

  /** Il ruolo `admin` è solo l’accesso portale (email/password); non è un operatore di sede e non va elencato qui. */
  const profiles = (scopedSedeId
    ? (profilesRaw ?? []).filter((p) => p.sede_id === scopedSedeId)
    : (profilesRaw ?? [])
  ).filter((p) => p.role !== 'admin')

  return NextResponse.json({ sedi: sediWithCounts, profiles, adminListScope })
}

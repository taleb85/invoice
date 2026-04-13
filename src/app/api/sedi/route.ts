import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, sede_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const scopedSedeId = profile.sede_id?.trim() || null
  /** `global` = admin master senza sede; `sede` = admin assegnato a una filiale → solo quella sede, niente vista multi-sede/utenti orfani. */
  const adminListScope: 'global' | 'sede' = scopedSedeId ? 'sede' : 'global'

  const { data: sediRaw, error } = await supabase
    .from('sedi')
    .select('*')
    .order('nome')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sedi =
    scopedSedeId ? (sediRaw ?? []).filter((s) => s.id === scopedSedeId) : (sediRaw ?? [])

  // Conta per ogni sede
  const sediWithCounts = await Promise.all(
    sedi.map(async (sede) => {
      const [{ count: fornitori_count }, { count: bolle_count }, { count: fatture_count }, { count: users_count }] =
        await Promise.all([
          supabase.from('fornitori').select('*', { count: 'exact', head: true }).eq('sede_id', sede.id),
          supabase.from('bolle').select('*', { count: 'exact', head: true }).eq('sede_id', sede.id),
          supabase.from('fatture').select('*', { count: 'exact', head: true }).eq('sede_id', sede.id),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('sede_id', sede.id),
        ])
      return {
        ...sede,
        fornitori_count: fornitori_count ?? 0,
        bolle_count: bolle_count ?? 0,
        fatture_count: fatture_count ?? 0,
        users_count: users_count ?? 0,
      }
    })
  )

  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('*, sedi(id, nome, created_at)')
    .order('email')

  const profiles =
    scopedSedeId
      ? (profilesRaw ?? []).filter((p) => p.sede_id === scopedSedeId)
      : (profilesRaw ?? [])

  return NextResponse.json({ sedi: sediWithCounts, profiles, adminListScope })
}

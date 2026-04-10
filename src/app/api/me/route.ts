import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, sede_id, sedi(id, nome, country_code)')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 })

  const isAdmin = profile.role === 'admin'
  const sede = Array.isArray(profile.sedi)
    ? profile.sedi[0] as { id: string; nome: string; country_code: string } | null
    : profile.sedi as { id: string; nome: string; country_code: string } | null

  let allSedi: { id: string; nome: string }[] = []
  if (isAdmin) {
    const { data: sediData } = await supabase.from('sedi').select('id, nome').order('nome')
    allSedi = sediData ?? []
  }

  return NextResponse.json({
    user:         { id: user.id, email: user.email },
    role:         profile.role,
    sede_id:      profile.sede_id,
    sede_nome:    sede?.nome ?? null,
    country_code: sede?.country_code ?? 'UK',
    is_admin:     isAdmin,
    all_sedi:     allSedi,
  })
}

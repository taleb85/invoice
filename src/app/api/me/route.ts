import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, sede_id, sedi(id, nome, country_code, currency, timezone)')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const isAdmin = String(profile.role ?? '').toLowerCase() === 'admin'
  type SedeRow = { id: string; nome: string; country_code: string; currency: string | null; timezone: string | null }
  const sede = Array.isArray(profile.sedi)
    ? profile.sedi[0] as SedeRow | null
    : profile.sedi as SedeRow | null

  let allSedi: { id: string; nome: string }[] = []
  if (isAdmin) {
    const { data: sediData } = await supabase.from('sedi').select('id, nome').order('nome')
    allSedi = sediData ?? []
  }

  let effectiveSedeId: string | null = profile.sede_id
  let effectiveSedeNome: string | null = sede?.nome ?? null
  let countryCode = sede?.country_code ?? 'UK'
  let currency = sede?.currency ?? 'GBP'
  let timezone = sede?.timezone ?? 'Europe/London'

  if (isAdmin) {
    const pick = (await cookies()).get('admin-sede-id')?.value?.trim()
    if (pick) {
      const { data: picked } = await supabase
        .from('sedi')
        .select('id, nome, country_code, currency, timezone')
        .eq('id', pick)
        .maybeSingle()
      if (picked?.id) {
        effectiveSedeId = picked.id
        effectiveSedeNome = picked.nome ?? null
        countryCode = picked.country_code ?? countryCode
        currency = picked.currency ?? currency
        timezone = picked.timezone ?? timezone
      }
    }
  }

  return NextResponse.json({
    user:         { id: user.id, email: user.email },
    role:         profile.role,
    sede_id:      effectiveSedeId,
    sede_nome:    effectiveSedeNome,
    country_code: countryCode,
    currency:     currency ?? 'GBP',
    timezone:     timezone ?? 'Europe/London',
    is_admin:     isAdmin,
    all_sedi:     allSedi,
  })
}

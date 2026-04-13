import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import type { MeData } from '@/lib/me-context'
import { isAdminSedeRole, isMasterAdminRole } from '@/lib/roles'

export type AppMeShellResult =
  | { ok: true; me: MeData }
  | { ok: false; kind: 'unauth' | 'noprofile' }

/**
 * Stessa logica di GET `/api/me`, per idratare `UserProvider` al primo paint
 * (dock mobile, padding hub, ecc.) senza aspettare il fetch client.
 */
export async function getAppMeShellResult(): Promise<AppMeShellResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, kind: 'unauth' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, sede_id, sedi(id, nome, country_code, currency, timezone)')
    .eq('id', user.id)
    .single()

  if (!profile) return { ok: false, kind: 'noprofile' }

  const isAdmin = isMasterAdminRole(profile.role)
  const isAdminSede = isAdminSedeRole(profile.role)
  type SedeRow = { id: string; nome: string; country_code: string; currency: string | null; timezone: string | null }
  const sede = Array.isArray(profile.sedi)
    ? (profile.sedi[0] as SedeRow | null)
    : (profile.sedi as SedeRow | null)

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

  const rawRole = String(profile.role ?? '').toLowerCase()
  const role: MeData['role'] =
    rawRole === 'admin' ? 'admin' : rawRole === 'admin_sede' ? 'admin_sede' : rawRole === 'operatore' ? 'operatore' : null

  return {
    ok: true,
    me: {
      user: { id: user.id, email: user.email ?? '' },
      role,
      sede_id: effectiveSedeId,
      sede_nome: effectiveSedeNome,
      country_code: countryCode,
      currency: currency ?? 'GBP',
      timezone: timezone ?? 'Europe/London',
      is_admin: isAdmin,
      is_admin_sede: isAdminSede,
      all_sedi: allSedi,
    },
  }
}

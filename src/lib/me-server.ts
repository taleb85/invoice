import { cookies } from 'next/headers'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import type { MeData } from '@/lib/me-context'
import { isCorporateSedeAdminRole, isMasterAdminRole, isAdminTecnicoRole } from '@/lib/roles'

export type AppMeShellResult =
  | { ok: true; me: MeData }
  | { ok: false; kind: 'unauth' | 'noprofile' }

/**
 * Stessa logica di GET `/api/me`, per idratare `UserProvider` al primo paint
 * (dock mobile, padding hub, ecc.) senza aspettare il fetch client.
 */
export async function getAppMeShellResult(): Promise<AppMeShellResult> {
  try {
    return await loadAppMeShellResult()
  } catch (e) {
    console.error('[getAppMeShellResult]', e)
    /* Evita 500 sulla shell: il client ritenta con GET /api/me */
    return { ok: false, kind: 'noprofile' }
  }
}

async function loadAppMeShellResult(): Promise<AppMeShellResult> {
  const { supabase, user } = await getRequestAuth()
  if (!user) return { ok: false, kind: 'unauth' }

  const PROFILE_SELECT =
    'role, sede_id, full_name, sedi(id, nome, country_code, currency, timezone)' as const

  let { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    const svc = createServiceClient()
    const r = await svc.from('profiles').select(PROFILE_SELECT).eq('id', user.id).maybeSingle()
    profile = r.data
    if (!profile && profileErr?.message) {
      console.warn('[loadAppMeShellResult] profile user-bound read:', profileErr.message)
    }
  }

  if (!profile) return { ok: false, kind: 'noprofile' }

  const isAdmin = isMasterAdminRole(profile.role)
  const isCorporateSedeAdmin = isCorporateSedeAdminRole(profile.role)
  const isTecnicoSede = isAdminTecnicoRole(profile.role)
  type SedeRow = { id: string; nome: string; country_code: string; currency: string | null; timezone: string | null }
  const sede = Array.isArray(profile.sedi)
    ? (profile.sedi[0] as SedeRow | null)
    : (profile.sedi as SedeRow | null)

  let effectiveSedeId: string | null = profile.sede_id
  let effectiveSedeNome: string | null = sede?.nome ?? null
  let countryCode = sede?.country_code ?? 'UK'
  let currency = sede?.currency ?? 'GBP'
  let timezone = sede?.timezone ?? 'Europe/London'

  let allSedi: { id: string; nome: string }[] = []
  if (isAdmin) {
    const pick = (await cookies()).get('admin-sede-id')?.value?.trim()
    const [sediListRes, pickedRes] = await Promise.all([
      supabase.from('sedi').select('id, nome').order('nome'),
      pick
        ? supabase
            .from('sedi')
            .select('id, nome, country_code, currency, timezone')
            .eq('id', pick)
            .maybeSingle()
        : Promise.resolve({ data: null as SedeRow | null }),
    ])
    allSedi = sediListRes.data ?? []
    const picked = pickedRes.data
    if (pick && picked?.id) {
      effectiveSedeId = picked.id
      effectiveSedeNome = picked.nome ?? null
      countryCode = picked.country_code ?? countryCode
      currency = picked.currency ?? currency
      timezone = picked.timezone ?? timezone
    }
  }

  const rawRole = String(profile.role ?? '').toLowerCase()
  const role: MeData['role'] =
    rawRole === 'admin'
      ? 'admin'
      : rawRole === 'admin_sede'
        ? 'admin_sede'
        : rawRole === 'admin_tecnico'
          ? 'admin_tecnico'
          : rawRole === 'operatore'
            ? 'operatore'
            : null

  const fn = typeof profile.full_name === 'string' ? profile.full_name.trim() : ''
  // Master admin without any sedi configured → onboarding not yet complete
  const onboarding_complete = !isAdmin || allSedi.length > 0

  return {
    ok: true,
    me: {
      user: { id: user.id, email: user.email ?? '' },
      full_name: fn || null,
      role,
      sede_id: effectiveSedeId,
      sede_nome: effectiveSedeNome,
      country_code: countryCode,
      currency: currency ?? 'GBP',
      timezone: timezone ?? 'Europe/London',
      is_admin: isAdmin,
      is_admin_sede: isCorporateSedeAdmin,
      is_admin_tecnico: isTecnicoSede,
      all_sedi: allSedi,
      onboarding_complete,
    },
  }
}


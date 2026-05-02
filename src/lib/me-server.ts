import { cookies } from 'next/headers'
import { getRequestAuth } from '@/utils/supabase/server'
import type { MeData } from '@/lib/me-context'
import { isAdminSedeRole, isAdminTecnicoRole, isMasterAdminRole } from '@/lib/roles'
import { resolveActiveSedeIdForLists } from '@/lib/resolve-active-sede-for-lists'

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

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('role, sede_id, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (profileErr || !profile) return { ok: false, kind: 'noprofile' }

  const cookieStore = await cookies()
  const operationalSedeId = await resolveActiveSedeIdForLists(
    supabase,
    { role: profile.role, sede_id: profile.sede_id },
    (name) => cookieStore.get(name),
  )

  const isAdmin = isMasterAdminRole(profile.role)
  const isAdminSede = isAdminSedeRole(profile.role)
  const isAdminTecnico = isAdminTecnicoRole(profile.role)

  let effectiveSedeNome: string | null = null
  let countryCode = 'UK'
  let currency: string | null = 'GBP'
  let timezone: string | null = 'Europe/London'

  if (operationalSedeId) {
    const { data: sedeFull } = await supabase
      .from('sedi')
      .select('id, nome, country_code, currency, timezone')
      .eq('id', operationalSedeId)
      .maybeSingle()
    if (sedeFull) {
      effectiveSedeNome = sedeFull.nome ?? null
      countryCode = sedeFull.country_code ?? countryCode
      currency = sedeFull.currency ?? currency
      timezone = sedeFull.timezone ?? timezone
    }
  }

  let allSedi: { id: string; nome: string }[] = []
  if (isAdmin) {
    const { data: rows } = await supabase.from('sedi').select('id, nome').order('nome', { ascending: true })
    allSedi = rows ?? []
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
  const onboarding_complete = !isAdmin || allSedi.length > 0

  return {
    ok: true,
    me: {
      user: { id: user.id, email: user.email ?? '' },
      full_name: fn || null,
      role,
      sede_id: operationalSedeId,
      sede_nome: effectiveSedeNome,
      country_code: countryCode,
      currency: currency ?? 'GBP',
      timezone: timezone ?? 'Europe/London',
      is_admin: isAdmin,
      is_admin_sede: isAdminSede,
      is_admin_tecnico: isAdminTecnico,
      all_sedi: allSedi,
      onboarding_complete,
    },
  }
}

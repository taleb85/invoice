import type { SupabaseClient } from '@supabase/supabase-js'
import { isBranchSedeStaffRole, isMasterAdminRole } from '@/lib/roles'
import { createServiceClient } from '@/utils/supabase/server'

/** Lettura cookie come in `getCookieStore()` / `cookies()`. */
export type ListPageCookieGet = (name: string) => { value?: string } | undefined

async function firstSedeId(): Promise<string | null> {
  const service = createServiceClient()
  const { data } = await service
    .from('sedi')
    .select('id')
    .order('nome', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

async function sedeIdIfExists(id: string): Promise<string | null> {
  const service = createServiceClient()
  const { data } = await service.from('sedi').select('id').eq('id', id).maybeSingle()
  return data?.id ?? null
}

/**
 * Staff con `sede_id` null (es. dopo ON DELETE SET NULL sulla sede) ma tenant con **una sola**
 * filiale: riallinea il profilo via service role. Sicuro perimetro — non si assegna sede a caso
 * quando esistono più sedi.
 */
async function healBranchStaffSedeIfSingleTenant(userId: string): Promise<string | null> {
  const service = createServiceClient()
  const { count, error: cntErr } = await service.from('sedi').select('id', { count: 'exact', head: true })
  if (cntErr || count !== 1) return null
  const onlySedeId = await firstSedeId()
  if (!onlySedeId) return null
  const { error: upErr } = await service
    .from('profiles')
    .update({ sede_id: onlySedeId })
    .eq('id', userId)
    .is('sede_id', null)
  if (upErr) {
    console.warn('[resolveActiveSedeIdForLists] heal branch sede_id failed', upErr)
    return null
  }
  return onlySedeId
}

/**
 * Compatta `profiles` quando mancano campi utili alla risoluzione sede:
 * prima si evitava la SELECT se arrivava solo `role` senza `sede_id`, e gli staff restavano senza filiale.
 */
async function ensuredProfileBasics(
  supabase: SupabaseClient,
  profile: { role?: string | null; sede_id?: string | null } | null | undefined,
): Promise<{ role?: string | null; sede_id?: string | null } | null> {
  const hasRole = profile?.role != null && String(profile.role).trim() !== ''
  const hasSedeId =
    typeof profile?.sede_id === 'string' && profile.sede_id.trim() !== ''
  if (hasRole && (hasSedeId || isMasterAdminRole(profile?.role))) {
    return profile ?? null
  }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return profile ?? null
  const { data } = await supabase.from('profiles').select('role, sede_id').eq('id', user.id).maybeSingle()
  return data ?? profile ?? null
}

/**
 * sede attiva per elenchi `/fornitori`, `/bolle`, `/fatture` e per la dashboard KPI.
 *
 * Master (`profiles.role === 'admin'`, anche con `sede_id` null):
 * 1. cookie `admin-sede-id` se presente e valida in `sedi`
 * 2. altrimenti prima sede (`ORDER BY nome LIMIT 1`)
 * 3. `null` solo se non ci sono righe in `public.sedi`
 *
 * Staff sede (`admin_sede`, `admin_tecnico`, `operatore`): `profiles.sede_id` dalla riga utente — nessuna SELECT su `sedi` (evita RLS).
 * Eccezione: tenant con una sola sede e profilo staff senza `sede_id` → auto-riparazione (service role).
 * Master dopo eventuale `sede_id` sul profilo: cookie + SELECT `sedi` solo con service role.
 */
export async function resolveActiveSedeIdForLists(
  supabase: SupabaseClient,
  profile: { role?: string | null; sede_id?: string | null } | null | undefined,
  getCookie: ListPageCookieGet,
): Promise<string | null> {
  const p = await ensuredProfileBasics(supabase, profile)
  if (!p?.role || String(p.role).trim() === '') return null

  const trimmedSedeId =
    typeof p.sede_id === 'string' && p.sede_id.trim() !== '' ? p.sede_id.trim() : null
  if (trimmedSedeId) return trimmedSedeId

  if (!isMasterAdminRole(p.role)) {
    if (!isBranchSedeStaffRole(p.role)) return null
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) return null
    return (await healBranchStaffSedeIfSingleTenant(user.id)) ?? null
  }

  const pick = getCookie('admin-sede-id')?.value?.trim() || null
  if (pick) {
    const id = await sedeIdIfExists(pick)
    if (id) return id
  }
  /* Cookie assente / non valido: mai lasciare il master senza sede quando ne esiste almeno una. */
  return (await firstSedeId()) ?? null
}

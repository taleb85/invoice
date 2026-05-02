import type { SupabaseClient } from '@supabase/supabase-js'
import { isBranchSedeStaffRole, isMasterAdminRole } from '@/lib/roles'
import { createServiceClient } from '@/utils/supabase/server'

/** Lettura cookie come in `getCookieStore()` / `cookies()`. */
export type ListPageCookieGet = (name: string) => { value?: string } | undefined

function hasServiceRoleKey(): boolean {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY
  return typeof k === 'string' && k.trim() !== ''
}

/** Prima sede: client sessione (RLS `sedi` per tutti gli autenticati) — non richiede service role. */
async function firstSedeIdFromUser(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from('sedi')
    .select('id')
    .order('nome', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn('[resolveActiveSedeIdForLists] firstSedeIdFromUser', error)
    return null
  }
  return data?.id ?? null
}

async function sedeIdIfExistsFromUser(supabase: SupabaseClient, id: string): Promise<string | null> {
  const { data, error } = await supabase.from('sedi').select('id').eq('id', id).maybeSingle()
  if (error) return null
  return data?.id ?? null
}

async function firstSedeId(): Promise<string | null> {
  if (!hasServiceRoleKey()) return null
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
  if (!hasServiceRoleKey()) return null
  const service = createServiceClient()
  const { data } = await service.from('sedi').select('id').eq('id', id).maybeSingle()
  return data?.id ?? null
}

/**
 * Ultima sede nota da `device_sessions` (Accesso sede / PIN): stesso utente che ha perso
 * `profiles.sede_id` può riaverla senza intervento admin, anche con più sedi nel tenant.
 */
async function healBranchStaffSedeFromLastDeviceSession(userId: string): Promise<string | null> {
  if (!hasServiceRoleKey()) return null
  const service = createServiceClient()
  const { data, error } = await service
    .from('device_sessions')
    .select('sede_id')
    .eq('profile_id', userId)
    .order('last_seen_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data || data.sede_id == null) return null
  const raw = String(data.sede_id).trim()
  if (!raw) return null
  const exists = await sedeIdIfExists(raw)
  if (!exists) return null
  const { error: upErr } = await service
    .from('profiles')
    .update({ sede_id: exists })
    .eq('id', userId)
    .is('sede_id', null)
  if (upErr) {
    console.warn('[resolveActiveSedeIdForLists] heal from device_sessions failed', upErr)
    return null
  }
  return exists
}

/**
 * Staff con `sede_id` null (es. dopo ON DELETE SET NULL sulla sede) ma tenant con **una sola**
 * filiale: aggiorna il profilo con il client sessione (policy `profiles_update_own`).
 * Funziona anche senza `SUPABASE_SERVICE_ROLE_KEY` su Vercel.
 */
async function healBranchStaffSedeIfSingleTenantWithUser(
  userId: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  const { count, error: cntErr } = await supabase.from('sedi').select('id', { count: 'exact', head: true })
  if (cntErr || count !== 1) return null
  const onlySedeId = await firstSedeIdFromUser(supabase)
  if (!onlySedeId) return null
  const { error: upErr } = await supabase
    .from('profiles')
    .update({ sede_id: onlySedeId })
    .eq('id', userId)
    .is('sede_id', null)
  if (upErr) {
    console.warn('[resolveActiveSedeIdForLists] heal single-tenant (user)', upErr)
    return null
  }
  return onlySedeId
}

/**
 * Stesso perimetro di {@link healBranchStaffSedeIfSingleTenantWithUser}, via service (backup).
 */
async function healBranchStaffSedeIfSingleTenant(userId: string): Promise<string | null> {
  if (!hasServiceRoleKey()) return null
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
    console.warn('[resolveActiveSedeIdForLists] heal branch sede_id (service) failed', upErr)
    return null
  }
  return onlySedeId
}

async function healBranchStaffSedeOrphan(userId: string, supabase: SupabaseClient): Promise<string | null> {
  const fromUser = await healBranchStaffSedeIfSingleTenantWithUser(userId, supabase)
  if (fromUser) return fromUser
  if (!hasServiceRoleKey()) return null
  return (
    (await healBranchStaffSedeFromLastDeviceSession(userId)) ?? (await healBranchStaffSedeIfSingleTenant(userId))
  )
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
 * Eccezione senza `sede_id`: se c’è una sola sede → `UPDATE` profilo con client sessione; altrimenti (con service role) última `device_sessions` o heal service.
 * Master: cookie + prima sede lette con **client sessione** su `sedi` (no service obbligatorio); fallback service se mancano permessi.
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
    return (await healBranchStaffSedeOrphan(user.id, supabase)) ?? null
  }

  const pick = getCookie('admin-sede-id')?.value?.trim() || null
  if (pick) {
    const id = (await sedeIdIfExistsFromUser(supabase, pick)) ?? (await sedeIdIfExists(pick))
    if (id) return id
  }
  /* Cookie assente / non valido: prima sede con sessione utente (Vercel senza service role). */
  return (await firstSedeIdFromUser(supabase)) ?? (await firstSedeId()) ?? null
}

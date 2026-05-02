import type { SupabaseClient } from '@supabase/supabase-js'
import { isMasterAdminRole } from '@/lib/roles'

/** Lettura cookie come in `getCookieStore()` / `cookies()`. */
export type ListPageCookieGet = (name: string) => { value?: string } | undefined

async function firstSedeId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from('sedi')
    .select('id')
    .order('nome', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

/**
 * Alcune Server Actions passano solo `profiles` parziali; garantiamo `role` con una lettura compatta se manca.
 */
async function ensuredProfileBasics(
  supabase: SupabaseClient,
  profile: { role?: string | null; sede_id?: string | null } | null | undefined,
): Promise<{ role?: string | null; sede_id?: string | null } | null> {
  if (profile?.role != null && String(profile.role).trim() !== '') {
    return profile
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
 * Staff sede (`admin_sede`, `admin_tecnico`, `operatore`): `profiles.sede_id` trimmato, o null se vuoto.
 */
export async function resolveActiveSedeIdForLists(
  supabase: SupabaseClient,
  profile: { role?: string | null; sede_id?: string | null } | null | undefined,
  getCookie: ListPageCookieGet,
): Promise<string | null> {
  const p = await ensuredProfileBasics(supabase, profile)
  if (!p?.role || String(p.role).trim() === '') return null

  if (isMasterAdminRole(p.role)) {
    const pick = getCookie('admin-sede-id')?.value?.trim() || null
    if (pick) {
      const { data } = await supabase.from('sedi').select('id').eq('id', pick).maybeSingle()
      if (data?.id) return data.id
    }
    /* Cookie assente / non valido: mai lasciare il master senza sede quando ne esiste almeno una. */
    return (await firstSedeId(supabase)) ?? null
  }

  const raw = p.sede_id
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null
}

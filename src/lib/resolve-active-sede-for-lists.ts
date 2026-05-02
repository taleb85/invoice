import type { SupabaseClient } from '@supabase/supabase-js'
import { isMasterAdminRole } from '@/lib/roles'

/** Lettura cookie come in `getCookieStore()` / `cookies()`. */
export type ListPageCookieGet = (name: string) => { value?: string } | undefined

/**
 * sede attiva per elenchi globali `/fornitori`, `/bolle`, `/fatture`:
 * master = cookie `admin-sede-id` se valida, altrimenti prima sede; staff = `profiles.sede_id`.
 */
export async function resolveActiveSedeIdForLists(
  supabase: SupabaseClient,
  profile: { role?: string | null; sede_id?: string | null } | null | undefined,
  getCookie: ListPageCookieGet,
): Promise<string | null> {
  if (!profile) return null
  if (isMasterAdminRole(profile.role)) {
    const pick = getCookie('admin-sede-id')?.value?.trim() || null
    if (pick) {
      const { data } = await supabase.from('sedi').select('id').eq('id', pick).maybeSingle()
      if (data?.id) return data.id
    }
    const { data: first } = await supabase.from('sedi').select('id').order('nome').limit(1).maybeSingle()
    return first?.id ?? null
  }
  const raw = profile.sede_id
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { isMasterAdminRole } from '@/lib/roles'
import {
  resolveActiveSedeIdForLists,
  firstSedeIdFromUser,
  type ListPageCookieGet,
} from '@/lib/resolve-active-sede-for-lists'

/**
 * Sede operativa per il **portale** (home, analytics, header FY): distingue vista **globale**
 * (tutta la rete nel DB del deploy) e vista **filiale** (`admin-sede-id`).
 *
 * **Oggi:** un progetto Supabase = un cliente; non c’è ancora `organization_id` sulle righe
 * (`docs/DEPLOY_PER_CLIENTE.md`). Con master senza cookie la UI portale **non** mostra totali
 * operativi aggregati tra sedi; per dati acquisti/fatture serve `admin-sede-id` o equivalente.
 * **Domani:** quando introdurrete organizzazioni nel DB, questo è il punto unico in cui applicare
 * il filtro “organizzazione” vs “filiale” senza rivisitare ogni pagina.
 *
 * Per elenchi che devono sempre avere un perimetro sede (es. `/fornitori`) usare solo
 * {@link resolveActiveSedeIdForLists}.
 */
export async function resolveOperationalSedeIdForAdminPortal(
  supabase: SupabaseClient,
  profile: { role?: string | null; sede_id?: string | null } | null | undefined,
  getCookie: ListPageCookieGet,
): Promise<string | null> {
  const effectiveRole = profile?.role ?? null
  const isMasterAdmin = isMasterAdminRole(effectiveRole)
  const adminPick = isMasterAdmin ? getCookie('admin-sede-id')?.value?.trim() || null : null

  let operationalSedeId = await resolveActiveSedeIdForLists(supabase, profile, getCookie)
  const profileSedeTrim =
    profile?.sede_id && String(profile.sede_id).trim() !== '' ? String(profile.sede_id).trim() : null
  if (!operationalSedeId && profileSedeTrim) {
    operationalSedeId = profileSedeTrim
  }
  if (isMasterAdmin && !adminPick) {
    operationalSedeId = null
  } else if (!operationalSedeId && isMasterAdmin) {
    operationalSedeId = await firstSedeIdFromUser(supabase)
  }

  return operationalSedeId
}

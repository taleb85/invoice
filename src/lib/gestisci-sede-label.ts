import type { Translations } from '@/lib/translations'
import type { MeData } from '@/lib/me-context'

/** Nome sede dal profilo o, per admin, dal cookie `admin-sede-id` + `all_sedi`. */
export function getAssociatedSedeNome(
  me: MeData | null,
  readCookie: (name: string) => string
): string {
  if (!me) return ''
  const fromProfile = me.sede_nome?.trim()
  if (fromProfile) return fromProfile
  if (me.is_admin) {
    const id = readCookie('admin-sede-id')?.trim()
    if (id && me.all_sedi?.length) {
      const hit = me.all_sedi.find((s) => s.id === id)
      return hit?.nome?.trim() ?? ''
    }
  }
  return ''
}

export function navGestisciSediLabel(t: Translations, sedeNome: string): string {
  const n = sedeNome.trim()
  if (n) return t.nav.gestisciSedeNamed.replace(/\{name\}/g, n)
  return t.nav.gestisciSedi
}

export function dashboardManageSediLabel(t: Translations, sedeNome: string): string {
  const n = sedeNome.trim()
  if (n) return t.dashboard.manageSedeNamed.replace(/\{name\}/g, n)
  return t.dashboard.manageSedi
}

import type { MeData } from '@/lib/me-context'
import type { ActiveOperator } from '@/lib/active-operator-context'

/** Admin master che ha scelto un operatore con PIN (vista “da banco”). */
export function actingAsMasterWithOperator(
  me: Pick<MeData, 'is_admin'> | null | undefined,
  activeOperator: Pick<ActiveOperator, 'id'> | null | undefined,
): boolean {
  return Boolean(me?.is_admin && activeOperator)
}

/** Vista piano master: account admin senza operatore PIN attivo. */
export function effectiveIsMasterAdminPlane(
  me: Pick<MeData, 'is_admin'> | null | undefined,
  activeOperator: unknown,
): boolean {
  return Boolean(me?.is_admin && !activeOperator)
}

/**
 * Permessi UI da “responsabile sede” (voce log, link gestione sedi, form operatori in impostazioni):
 * con operatore attivo segue il suo `role`, altrimenti il profilo di sessione.
 * Se `role` manca nello storage (legacy) ma l’operatore attivo è lo stesso utente del login, si usa il ruolo del profilo —
 * altrimenti un admin_sede dopo il PIN non vedrebbe “Gestisci sede”.
 */
export function effectiveIsAdminSedeUi(
  me: Pick<MeData, 'is_admin' | 'is_admin_sede' | 'user'> | null | undefined,
  activeOperator: Pick<ActiveOperator, 'role' | 'id'> | null | undefined,
): boolean {
  if (!me) return false
  if (me.is_admin && activeOperator) {
    return activeOperator.role === 'admin_sede'
  }
  if (activeOperator) {
    const r = activeOperator.role
    if (r === 'admin_sede') return true
    if (r === 'operatore') return false
    const sameAsSession =
      Boolean(me.user?.id && activeOperator.id === me.user.id)
    if (sameAsSession) {
      return Boolean(me.is_admin_sede && !me.is_admin)
    }
    return false
  }
  return Boolean(me.is_admin_sede && !me.is_admin)
}

/**
 * Griglia fornitori: modifica / elimina senza step PIN operatore.
 * Master solo senza PIN; altrimenti solo se il ruolo effettivo è admin_sede.
 */
export function effectiveIsFornitoreGridAdmin(
  me: Pick<MeData, 'is_admin' | 'is_admin_sede' | 'user'> | null | undefined,
  activeOperator: Pick<ActiveOperator, 'role' | 'id'> | null | undefined,
): boolean {
  if (!me) return false
  if (me.is_admin && !activeOperator) return true
  return effectiveIsAdminSedeUi(me, activeOperator)
}

/** Coerente con `proxy.ts` su `/sedi`: solo `admin` o `admin_sede` nel profilo reale (non basta il PIN come altro ruolo). */
export function profileCanAccessSediListPage(
  me: Pick<MeData, 'is_admin' | 'is_admin_sede'> | null | undefined,
): boolean {
  return Boolean(me?.is_admin || me?.is_admin_sede)
}

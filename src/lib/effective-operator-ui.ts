import type { MeData } from '@/lib/me-context'
import type { ActiveOperator } from '@/lib/active-operator-context'

function isPrivilegedSedeRole(
  role: Pick<ActiveOperator, 'role'>['role'],
): role is 'admin_sede' | 'admin_tecnico' {
  return role === 'admin_sede' || role === 'admin_tecnico'
}

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
 * Permessi UI da “staff sede elevato” (log, gestione sedi, strumenti operatore/responsabile):
 * con operatore attivo segue il suo `role`, altrimenti il profilo di sessione.
 */
export function effectiveIsAdminSedeUi(
  me: Pick<MeData, 'is_admin' | 'is_admin_sede' | 'is_admin_tecnico' | 'user'> | null | undefined,
  activeOperator: Pick<ActiveOperator, 'role' | 'id'> | null | undefined,
): boolean {
  if (!me) return false
  if (me.is_admin && activeOperator) {
    return isPrivilegedSedeRole(activeOperator.role)
  }
  if (activeOperator) {
    const r = activeOperator.role
    if (isPrivilegedSedeRole(r)) return true
    if (r === 'operatore') return false
    const sameAsSession =
      Boolean(me.user?.id && activeOperator.id === me.user.id)
    if (sameAsSession) {
      return Boolean((me.is_admin_sede || me.is_admin_tecnico) && !me.is_admin)
    }
    return false
  }
  return Boolean((me.is_admin_sede || me.is_admin_tecnico) && !me.is_admin)
}

/**
 * Griglia fornitori: modifica / elimina senza step PIN operatore.
 * Master solo senza PIN; altrimenti solo se il ruolo effettivo è staff sede elevato.
 */
export function effectiveIsFornitoreGridAdmin(
  me: Pick<MeData, 'is_admin' | 'is_admin_sede' | 'is_admin_tecnico' | 'user'> | null | undefined,
  activeOperator: Pick<ActiveOperator, 'role' | 'id'> | null | undefined,
): boolean {
  if (!me) return false
  if (me.is_admin && !activeOperator) return true
  return effectiveIsAdminSedeUi(me, activeOperator)
}

/** Coerente con `proxy.ts` su `/sedi`: master o ruolo privilegiato sulla sede nel profilo reale. */
export function profileCanAccessSediListPage(
  me: Pick<MeData, 'is_admin' | 'is_admin_sede' | 'is_admin_tecnico'> | null | undefined,
): boolean {
  return Boolean(me?.is_admin || me?.is_admin_sede || me?.is_admin_tecnico)
}

/**
 * Ruoli applicativi (colonna `profiles.role` in Supabase).
 * `admin` = Admin Master (tutte le sedi).
 * `admin_sede` = responsabile filiale (perimetro sulla propria `sede_id`).
 */
export type AppRole = 'admin' | 'admin_sede' | 'operatore'

function normRole(raw: string | null | undefined): string {
  return String(raw ?? '').trim().toLowerCase()
}

export function parseAppRole(raw: string | null | undefined): AppRole | null {
  const r = normRole(raw)
  if (r === 'admin') return 'admin'
  if (r === 'admin_sede') return 'admin_sede'
  if (r === 'operatore') return 'operatore'
  return null
}

export function isMasterAdminRole(raw: string | null | undefined): boolean {
  return normRole(raw) === 'admin'
}

export function isAdminSedeRole(raw: string | null | undefined): boolean {
  return normRole(raw) === 'admin_sede'
}

/** Responsabile filiale (legacy: valore rimosso `admin_tecnico` trattato come admin_sede finché non gira la migration). */
export function isBranchSedeStaffRole(raw: string | null | undefined): boolean {
  const r = normRole(raw)
  return r === 'admin_sede' || r === 'admin_tecnico'
}

/**
 * Profilo che usa Accesso sede / PIN sul proprio utente Auth (non il portale solo-master email+password).
 */
export function isProfilesBranchDeskRole(raw: string | null | undefined): boolean {
  const r = normRole(raw)
  return r === 'operatore' || r === 'admin_sede' || r === 'admin_tecnico'
}

/** Master admin oppure ruoli con privilegi operativi su sede (escluso solo operatore «puro»). */
export function isSedePrivilegedRole(raw: string | null | undefined): boolean {
  return isMasterAdminRole(raw) || isBranchSedeStaffRole(raw)
}

/** Inbox duplicati / eliminazione copie: master (sede selezionata), admin sede o operatore sulla propria sede. */
export function canAccessSedeDuplicateTools(
  profile: { role?: string | null; sede_id?: string | null } | null | undefined,
  sedeId: string | null,
): boolean {
  if (!sedeId?.trim() || !profile) return false
  if (isMasterAdminRole(profile.role)) return true
  if (profile.sede_id !== sedeId) return false
  return isSedePrivilegedRole(profile.role) || normRole(profile.role) === 'operatore'
}

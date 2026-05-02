/**
 * Ruoli applicativi (colonna `profiles.role` in Supabase).
 * `admin` = Admin Master (tutte le sedi). `admin_sede` | `admin_tecnico` = staff sede sulla propria `sede_id`.
 */
export type AppRole = 'admin' | 'admin_sede' | 'admin_tecnico' | 'operatore'

export function parseAppRole(raw: string | null | undefined): AppRole | null {
  const r = String(raw ?? '').toLowerCase()
  if (r === 'admin') return 'admin'
  if (r === 'admin_sede') return 'admin_sede'
  if (r === 'admin_tecnico') return 'admin_tecnico'
  if (r === 'operatore') return 'operatore'
  return null
}

export function isMasterAdminRole(raw: string | null | undefined): boolean {
  return String(raw ?? '').toLowerCase() === 'admin'
}

export function isAdminSedeRole(raw: string | null | undefined): boolean {
  return String(raw ?? '').toLowerCase() === 'admin_sede'
}

export function isAdminTecnicoRole(raw: string | null | undefined): boolean {
  return String(raw ?? '').toLowerCase() === 'admin_tecnico'
}

/** Responsabile o tecnico di sede (stesso perimetro sulla `sede_id`, non sono master globali). */
export function isBranchSedeStaffRole(raw: string | null | undefined): boolean {
  return isAdminSedeRole(raw) || isAdminTecnicoRole(raw)
}

/**
 * Profilo che usa Accesso sede / PIN sul proprio utente Auth (non il portale solo-master email+password).
 */
export function isProfilesBranchDeskRole(raw: string | null | undefined): boolean {
  const r = String(raw ?? '').toLowerCase()
  return r === 'operatore' || r === 'admin_sede' || r === 'admin_tecnico'
}

/** Master admin oppure ruoli con privilegi operativi su sede (escluso solo operatore «puro»). */
export function isSedePrivilegedRole(raw: string | null | undefined): boolean {
  return isMasterAdminRole(raw) || isBranchSedeStaffRole(raw)
}

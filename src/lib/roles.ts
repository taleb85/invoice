/**
 * Ruoli applicativi (colonna `profiles.role` in Supabase).
 * `admin` = Admin Master (tutte le sedi).
 * `admin_sede` = gestione completa sulla propria sede (anche utenti/PIN ruoli limitati).
 * `admin_tecnico` = stessi accessi dati/processi sulla sede, senza gestire account altrui.
 * `operatore` = operative con PIN.
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

/** Responsabile sede „commerciale“: può gestire operatori nella propria sede. */
export function isCorporateSedeAdminRole(raw: string | null | undefined): boolean {
  return String(raw ?? '').toLowerCase() === 'admin_sede'
}

export function isAdminTecnicoRole(raw: string | null | undefined): boolean {
  return String(raw ?? '').toLowerCase() === 'admin_tecnico'
}

/**
 * Elevazione su contenuti della sede (API Centro operazioni, IMAP, fornitori, ecc.):
 * `admin_sede` oppure `admin_tecnico`.
 */
export function isSedePrivilegedRole(raw: string | null | undefined): boolean {
  return isCorporateSedeAdminRole(raw) || isAdminTecnicoRole(raw)
}

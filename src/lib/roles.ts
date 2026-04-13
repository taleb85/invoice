/**
 * Ruoli applicativi (colonna `profiles.role` in Supabase).
 * `admin` = Admin Master (tutte le sedi). `admin_sede` = gestione completa solo sulla propria sede.
 */
export type AppRole = 'admin' | 'admin_sede' | 'operatore'

export function parseAppRole(raw: string | null | undefined): AppRole | null {
  const r = String(raw ?? '').toLowerCase()
  if (r === 'admin') return 'admin'
  if (r === 'admin_sede') return 'admin_sede'
  if (r === 'operatore') return 'operatore'
  return null
}

export function isMasterAdminRole(raw: string | null | undefined): boolean {
  return String(raw ?? '').toLowerCase() === 'admin'
}

export function isAdminSedeRole(raw: string | null | undefined): boolean {
  return String(raw ?? '').toLowerCase() === 'admin_sede'
}

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import type { Profile } from '@/types'

export type RoleLevel = 'master_admin' | 'sede_privileged'

export type AuthResult = { ok: true; profile: Profile; sedeId: string | null } | { ok: false; error: string; status: number }

/**
 * Verifica autenticazione base: qualsiasi utente loggato.
 */
export async function requireAuth(): Promise<AuthResult> {
  const profile = await getProfile()
  if (!profile) return { ok: false, error: 'Non autenticato', status: 401 }
  return { ok: true, profile, sedeId: profile.sede_id ?? null }
}

/**
 * Verifica autenticazione + ruolo minimo.
 * - master_admin: qualsiasi sede o nessuna sede
 * - sede_privileged: solo la propria sede (admin_sede + staff_filiale)
 * - staff_branch: solo la propria sede
 */
export async function requireRole(allowed: RoleLevel[]): Promise<AuthResult> {
  const base = await requireAuth()
  if (!base.ok) return base

  const { profile } = base
  const master = isMasterAdminRole(profile.role)
  const privileged = isSedePrivilegedRole(profile.role)

  if (allowed.includes('master_admin') && master) {
    return { ok: true, profile, sedeId: profile.sede_id ?? null }
  }

  if (allowed.includes('sede_privileged') && privileged) {
    return { ok: true, profile, sedeId: profile.sede_id ?? null }
  }

  return { ok: false, error: 'Accesso negato', status: 403 }
}

/**
 * Richiede autenticazione + ruolo privilegiato (master_admin o admin_sede).
 * Helper compatto per il caso più comune negli endpoint amministrativi.
 */
export async function requireAdmin(): Promise<
  | { ok: true; profile: Profile; sedeId: string | null }
  | { ok: false; error: string; status: number }
> {
  return requireRole(['master_admin', 'sede_privileged'])
}

/**
 * Risolve la sede operativa considerando ruolo e cookie.
 * - master_admin: usa cookie admin-sede-id se presente
 * - altri ruoli: usa profile.sede_id
 */
export async function resolveAdminSede(profile: Profile): Promise<string | null> {
  const master = isMasterAdminRole(profile.role)
  if (!master) return profile.sede_id?.trim() ?? null

  const cookieStore = await cookies()
  const adminPick = cookieStore.get('admin-sede-id')?.value?.trim()
  return adminPick || profile.sede_id?.trim() || null
}

/**
 * Crea una NextResponse di errore JSON con messaggio e status code.
 * Centralizza il pattern `return NextResponse.json({ error }, { status })`
 * e logga l'errore con contesto.
 */
export function apiError(error: unknown, context: string, defaultStatus = 500): NextResponse {
  const errMsg = error instanceof Error ? error.message : String(error ?? 'Errore sconosciuto')
  console.error(`[${context}]`, error)
  return NextResponse.json({ error: errMsg }, { status: defaultStatus })
}

/**
 * Session policy read/write helpers backed by `configurazioni_app`.
 *
 * Values in the DB override the code defaults in `session-policy.ts`.
 * When a DB row is missing the fallback is the hardcoded constant.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { SESSION_POLICY } from './session-policy'

// ── DB chiave constants ──────────────────────────────────────────────────────

export const SESSION_POLICY_CHIAVI = {
  operatore:   { maxAge: 'sessione_operatore_max_age_seconds',   inactivity: 'sessione_operatore_inactivity_seconds' },
  admin:       { maxAge: 'sessione_admin_max_age_seconds',       inactivity: 'sessione_admin_inactivity_seconds' },
  admin_sede:  { maxAge: 'sessione_admin_sede_max_age_seconds',  inactivity: 'sessione_admin_sede_inactivity_seconds' },
} as const

/** Human-readable labels keyed by DB chiave. */
export const SESSION_POLICY_DESCRIZIONI: Record<string, string> = {
  sessione_operatore_max_age_seconds:       'Operatore — durata massima sessione in secondi (default: 8 ore)',
  sessione_operatore_inactivity_seconds:    'Operatore — timeout inattività in secondi (default: 30 min)',
  sessione_admin_max_age_seconds:           'Admin — durata massima sessione in secondi (default: 24 ore)',
  sessione_admin_inactivity_seconds:        'Admin — timeout inattività in secondi (default: 2 ore)',
  sessione_admin_sede_max_age_seconds:      'Admin sede — durata massima sessione in secondi (default: 24 ore)',
  sessione_admin_sede_inactivity_seconds:   'Admin sede — timeout inattività in secondi (default: 2 ore)',
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface SessionPolicyPerRole {
  maxAgeSeconds: number
  inactivitySeconds: number
}

export type SessionPolicyRecord = Record<'operatore' | 'admin' | 'admin_sede', SessionPolicyPerRole>

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseSeconds(raw: string | null | undefined, fallback: number): number {
  if (raw == null) return fallback
  const n = Number(String(raw).trim())
  return Number.isFinite(n) && n > 0 ? n : fallback
}

async function fetchAllRows(
  supabase: Pick<SupabaseClient, 'from'>,
): Promise<Record<string, string>> {
  try {
    const allChiavi = Object.values(SESSION_POLICY_CHIAVI).flatMap((r) => [r.maxAge, r.inactivity])
    const { data, error } = await supabase
      .from('configurazioni_app')
      .select('chiave, valore')
      .in('chiave', allChiavi)
    if (error) {
      console.warn('[session-policy-store] read failed:', error.message)
      return {}
    }
    const result: Record<string, string> = {}
    for (const row of (data ?? []) as Array<{ chiave: string; valore: string }>) {
      result[row.chiave] = row.valore
    }
    return result
  } catch (e) {
    console.warn('[session-policy-store] read failed:', e)
    return {}
  }
}

/**
 * Build the full session policy merging DB overrides on top of code defaults.
 */
export async function fetchSessionPolicy(
  supabase: Pick<SupabaseClient, 'from'>,
): Promise<SessionPolicyRecord> {
  const rows = await fetchAllRows(supabase)

  function build(role: keyof typeof SESSION_POLICY_CHIAVI): SessionPolicyPerRole {
    const code = SESSION_POLICY[role]
    const db = SESSION_POLICY_CHIAVI[role]
    return {
      maxAgeSeconds:      parseSeconds(rows[db.maxAge], code.maxAgeSeconds),
      inactivitySeconds:  parseSeconds(rows[db.inactivity], code.inactivitySeconds),
    }
  }

  return {
    operatore:  build('operatore'),
    admin:      build('admin'),
    admin_sede: build('admin_sede'),
  }
}

/** Convenience: fetch a single role's policy. */
export async function fetchRoleSessionPolicy(
  supabase: Pick<SupabaseClient, 'from'>,
  role: keyof typeof SESSION_POLICY_CHIAVI,
): Promise<SessionPolicyPerRole> {
  const full = await fetchSessionPolicy(supabase)
  return full[role]
}

/** Upsert a single DB chiave. Returns false on failure. */
export async function upsertSessionPolicyChiave(
  supabase: Pick<SupabaseClient, 'from'>,
  chiave: string,
  valore: string,
): Promise<boolean> {
  try {
    const descrizione = SESSION_POLICY_DESCRIZIONI[chiave] ?? null
    const { error } = await supabase.from('configurazioni_app').upsert(
      { chiave, valore, descrizione },
      { onConflict: 'chiave' },
    )
    if (error) {
      console.warn('[session-policy-store] upsert failed:', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('[session-policy-store] upsert failed:', e)
    return false
  }
}

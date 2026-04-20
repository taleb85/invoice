/**
 * Session-activity tracking via `user_settings`.
 *
 * Persists `last_activity` and `session_start` timestamps per user so
 * that `/api/me` can enforce inactivity + max-age limits from
 * `session-policy.ts`.
 *
 * Implementation note — NULL in Postgres unique constraints:
 *   The `user_settings` table has UNIQUE(user_id, sede_id, setting_key).
 *   Postgres treats two NULLs as distinct, so an upsert with
 *   `onConflict: 'user_id,sede_id,setting_key'` does NOT work when
 *   sede_id IS NULL.  We therefore use an explicit DELETE + INSERT to
 *   guarantee at-most-one row per (user_id, NULL, key) pair.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { SESSION_POLICY, type UserRole } from './session-policy'

const ACTIVITY_KEY     = 'last_activity'
const SESSION_START_KEY = 'session_start'

// ── helpers ──────────────────────────────────────────────────────────────────

async function setSetting(
  supabase: SupabaseClient,
  userId: string,
  key: string,
  value: string,
): Promise<void> {
  // Delete first to work around the NULL unique-constraint limitation.
  await supabase
    .from('user_settings')
    .delete()
    .eq('user_id', userId)
    .is('sede_id', null)
    .eq('setting_key', key)

  await supabase.from('user_settings').insert([
    {
      user_id:     userId,
      sede_id:     null,
      setting_key: key,
      value,
      updated_at:  value, // value is ISO timestamp
    },
  ])
}

// ── public API ────────────────────────────────────────────────────────────────

/** Update the last-activity timestamp for a user. */
export async function recordActivity(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await setSetting(supabase, userId, ACTIVITY_KEY, new Date().toISOString())
}

/**
 * Record a fresh session start for a user.
 * Call this immediately after a successful login / PIN entry.
 */
export async function recordSessionStart(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const now = new Date().toISOString()
  await setSetting(supabase, userId, SESSION_START_KEY, now)
  // Also initialise activity so inactivity timer starts from login, not from first /api/me
  await setSetting(supabase, userId, ACTIVITY_KEY, now)
}

/**
 * Check whether the session is still within policy limits.
 * Returns `{ valid: true }` when everything is fine, or
 * `{ valid: false, reason: 'inactivity' | 'max_age' }` when expired.
 *
 * A missing `session_start` record is treated as valid (user may have
 * logged in before this feature was deployed).
 */
export async function checkSessionValid(
  supabase: SupabaseClient,
  userId: string,
  role: UserRole,
): Promise<{ valid: boolean; reason?: 'inactivity' | 'max_age' }> {
  const policy = SESSION_POLICY[role]
  const now = Date.now()

  const { data: rows } = await supabase
    .from('user_settings')
    .select('setting_key, value')
    .eq('user_id', userId)
    .is('sede_id', null)
    .in('setting_key', [ACTIVITY_KEY, SESSION_START_KEY])

  const byKey: Record<string, string> = Object.fromEntries(
    (rows ?? []).map((r) => [r.setting_key as string, r.value as string]),
  )

  const lastActivity = byKey[ACTIVITY_KEY]
  if (lastActivity) {
    const inactiveSec = (now - new Date(lastActivity).getTime()) / 1000
    if (inactiveSec > policy.inactivitySeconds) {
      return { valid: false, reason: 'inactivity' }
    }
  }

  const sessionStart = byKey[SESSION_START_KEY]
  if (sessionStart) {
    const ageSec = (now - new Date(sessionStart).getTime()) / 1000
    if (ageSec > policy.maxAgeSeconds) {
      return { valid: false, reason: 'max_age' }
    }
  }

  return { valid: true }
}

/**
 * Remove all session-tracking rows for a user.
 * Call after sign-out or PIN rotation.
 */
export async function clearSessionActivity(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await supabase
    .from('user_settings')
    .delete()
    .eq('user_id', userId)
    .is('sede_id', null)
    .in('setting_key', [ACTIVITY_KEY, SESSION_START_KEY])
}

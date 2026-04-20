/**
 * Application-layer session policy per role.
 *
 * Supabase Auth does not support per-role JWT expiry, so we enforce
 * these limits in application code via `session-activity.ts` which
 * persists heartbeat timestamps to `user_settings`.
 */
export const SESSION_POLICY = {
  /** Operatori: one shift maximum, 30 min inactivity kicks them out. */
  operatore: {
    maxAgeSeconds:      8 * 60 * 60,  // 8 hours absolute
    inactivitySeconds:  30 * 60,       // 30 min inactivity
  },
  /** Admin master: longer working day, 2 h inactivity. */
  admin: {
    maxAgeSeconds:      24 * 60 * 60,
    inactivitySeconds:   2 * 60 * 60,
  },
  admin_sede: {
    maxAgeSeconds:      24 * 60 * 60,
    inactivitySeconds:   2 * 60 * 60,
  },
} as const

export type UserRole = keyof typeof SESSION_POLICY

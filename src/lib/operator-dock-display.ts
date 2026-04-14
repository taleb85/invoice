import type { MeData } from '@/lib/me-context'

/**
 * Nome mostrato nel dock / sidebar “chi sta operando”:
 * operatore attivo (PIN) → altrimenti profilo sessione → altrimenti prefisso email.
 */
export function resolvedOperatorDockDisplay(
  me: MeData | null,
  activeOperator: { full_name: string } | null | undefined,
  noOperatorLabel: string,
): { displayName: string; avatarLetter: string } {
  const a = activeOperator?.full_name?.trim()
  if (a) return { displayName: a, avatarLetter: a.charAt(0).toUpperCase() }

  const p = me?.full_name?.trim()
  if (p) return { displayName: p, avatarLetter: p.charAt(0).toUpperCase() }

  const e = me?.user?.email?.split('@')[0]?.trim() ?? ''
  if (e) return { displayName: e, avatarLetter: e.charAt(0).toUpperCase() }

  return { displayName: noOperatorLabel, avatarLetter: '?' }
}

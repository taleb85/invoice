/** Gate per sessione tab/browser: operatore deve reinserire nome + PIN dopo nuova apertura. */
import { isProfilesBranchDeskRole } from '@/lib/roles'

export const SESSION_OPERATOR_GATE_KEY = 'fluxo-branch-session-gate-v1'

/**
 * Durante login operatore / device-restore su /accesso: evita che `visibilitychange` → `hidden`
 * chiami `clearSessionOperatorGate()` a metà flusso (loop loading → PIN su mobile/PWA).
 */
export const branchAccessoLoginInFlightRef = { current: false }

export function markSessionOperatorGateOk(): void {
  try {
    sessionStorage.setItem(SESSION_OPERATOR_GATE_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function clearSessionOperatorGate(): void {
  try {
    sessionStorage.removeItem(SESSION_OPERATOR_GATE_KEY)
  } catch {
    /* ignore */
  }
}

export function isSessionOperatorGateOk(): boolean {
  try {
    return sessionStorage.getItem(SESSION_OPERATOR_GATE_KEY) === '1'
  } catch {
    return false
  }
}

export function branchSessionGateRequiredRole(role: string | null | undefined): boolean {
  return isProfilesBranchDeskRole(role)
}

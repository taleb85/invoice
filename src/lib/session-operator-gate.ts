/** Gate per sessione tab/browser: operatore deve reinserire nome + PIN dopo nuova apertura. */
export const SESSION_OPERATOR_GATE_KEY = 'fluxo-branch-session-gate-v1'

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
  const r = String(role ?? '').toLowerCase()
  return r === 'operatore' || r === 'admin_sede'
}

/** Checkpoint client per riesame completo 1→N (sopravvive a refresh / rete). */

export const AUDIT_FULL_RESCAN_CHECKPOINT_KEY = 'invoice:audit-full-rescan-checkpoint'

export type AuditFullRescanCheckpoint = {
  version: 1
  sede_id: string | null
  scan_stage: 'documents' | 'statements'
  after_id: string | null
  statement_after_id: string | null
  totals: {
    iterations: number
    checked: number
    fornitore_fixed: number
    tipo_fixed: number
    flagged_for_review: number
    unchanged: number
    errors: number
    remaining: number
    initialRemaining: number | null
  }
  saved_at: string
  reason: 'progress' | 'network' | 'user_stop' | 'offline'
}

export function loadAuditFullRescanCheckpoint(): AuditFullRescanCheckpoint | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(AUDIT_FULL_RESCAN_CHECKPOINT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuditFullRescanCheckpoint
    if (parsed?.version !== 1) return null
    if (parsed.scan_stage !== 'documents' && parsed.scan_stage !== 'statements') return null
    return parsed
  } catch {
    return null
  }
}

export function saveAuditFullRescanCheckpoint(cp: AuditFullRescanCheckpoint): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(AUDIT_FULL_RESCAN_CHECKPOINT_KEY, JSON.stringify(cp))
  } catch {
    // quota / private mode
  }
}

export function clearAuditFullRescanCheckpoint(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(AUDIT_FULL_RESCAN_CHECKPOINT_KEY)
  } catch {
    // ignore
  }
}

export function checkpointMatchesSede(
  cp: AuditFullRescanCheckpoint,
  sedeId: string | null | undefined,
): boolean {
  const a = cp.sede_id?.trim() ?? null
  const b = sedeId?.trim() ?? null
  return a === b
}

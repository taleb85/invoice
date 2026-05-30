import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  AUDIT_FULL_RESCAN_CHECKPOINT_KEY,
  checkpointMatchesSede,
  clearAuditFullRescanCheckpoint,
  loadAuditFullRescanCheckpoint,
  saveAuditFullRescanCheckpoint,
  type AuditFullRescanCheckpoint,
} from '@/lib/audit-full-rescan-checkpoint'

const sample: AuditFullRescanCheckpoint = {
  version: 1,
  sede_id: 'sede-1',
  scan_stage: 'documents',
  after_id: 'doc-uuid-99',
  statement_after_id: null,
  totals: {
    iterations: 12,
    checked: 60,
    fornitore_fixed: 3,
    tipo_fixed: 1,
    flagged_for_review: 0,
    unchanged: 56,
    errors: 0,
    remaining: 2998,
    initialRemaining: 3058,
  },
  saved_at: '2026-05-30T12:00:00.000Z',
  reason: 'network',
}

function mockLocalStorage() {
  const store = new Map<string, string>()
  const ls = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    clear: () => store.clear(),
  }
  vi.stubGlobal('window', { localStorage: ls })
  return store
}

describe('audit-full-rescan-checkpoint', () => {
  beforeEach(() => {
    mockLocalStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips via localStorage', () => {
    saveAuditFullRescanCheckpoint(sample)
    expect(loadAuditFullRescanCheckpoint()).toEqual(sample)
    clearAuditFullRescanCheckpoint()
    expect(loadAuditFullRescanCheckpoint()).toBeNull()
  })

  it('matches sede scope', () => {
    expect(checkpointMatchesSede(sample, 'sede-1')).toBe(true)
    expect(checkpointMatchesSede(sample, 'other')).toBe(false)
    expect(checkpointMatchesSede({ ...sample, sede_id: null }, null)).toBe(true)
  })

  it('uses stable storage key', () => {
    expect(AUDIT_FULL_RESCAN_CHECKPOINT_KEY).toContain('audit-full-rescan')
  })
})

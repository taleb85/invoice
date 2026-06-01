import { describe, expect, it } from 'vitest'
import {
  effectivePendingDocDayIso,
  isYmdInHalfOpenRange,
  pendingDocLedgerPeriodOrFilter,
} from '@/lib/documenti-queue-period'

describe('documenti-queue-period', () => {
  it('builds pending or filter for PostgREST', () => {
    expect(pendingDocLedgerPeriodOrFilter('2026-05-01', '2026-05-02')).toContain('data_documento.gte.2026-05-01')
    expect(pendingDocLedgerPeriodOrFilter('2026-05-01', '2026-05-02')).toContain('created_at.lt.2026-05-02')
  })

  it('effective day prefers data_documento then metadata', () => {
    expect(
      effectivePendingDocDayIso({
        data_documento: '2026-04-15',
        created_at: '2026-05-01T10:00:00Z',
        metadata: { data_fattura: '2026-03-01' },
      }),
    ).toBe('2026-04-15')
    expect(
      effectivePendingDocDayIso({
        data_documento: null,
        created_at: '2026-05-01T10:00:00Z',
        metadata: { data_fattura: '2026-03-20' },
      }),
    ).toBe('2026-03-20')
  })

  it('half-open range is inclusive start exclusive end', () => {
    expect(isYmdInHalfOpenRange('2026-05-01', '2026-05-01', '2026-05-02')).toBe(true)
    expect(isYmdInHalfOpenRange('2026-05-02', '2026-05-01', '2026-05-02')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  getFileRetentionCutoffYmd,
  shouldRunRetentionForSede,
} from '@/lib/document-file-retention'

describe('getFileRetentionCutoffYmd', () => {
  it('keeps current and previous calendar month (June → cutoff May 1)', () => {
    const cutoff = getFileRetentionCutoffYmd(
      'Europe/Rome',
      2,
      new Date('2026-06-11T12:00:00Z'),
    )
    expect(cutoff).toBe('2026-05-01')
  })

  it('rolls year at January (Jan → cutoff Dec 1 previous year)', () => {
    const cutoff = getFileRetentionCutoffYmd(
      'Europe/Rome',
      2,
      new Date('2026-01-15T12:00:00Z'),
    )
    expect(cutoff).toBe('2025-12-01')
  })
})

describe('shouldRunRetentionForSede', () => {
  it('runs on configured run day', () => {
    const ok = shouldRunRetentionForSede(
      { file_retention_run_day: 5, timezone: 'Europe/Rome' },
      new Date('2026-06-05T10:00:00Z'),
      { force: false },
    )
    expect(ok).toBe(true)
  })

  it('skips other days unless force', () => {
    const ok = shouldRunRetentionForSede(
      { file_retention_run_day: 5, timezone: 'Europe/Rome' },
      new Date('2026-06-06T10:00:00Z'),
      { force: false },
    )
    expect(ok).toBe(false)
    expect(
      shouldRunRetentionForSede(
        { file_retention_run_day: 5, timezone: 'Europe/Rome' },
        new Date('2026-06-06T10:00:00Z'),
        { force: true },
      ),
    ).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { STATEMENT_ANOMALY_PREVIEW_LIMIT } from '@/lib/statement-anomaly-preview'

describe('statement-anomaly-preview', () => {
  it('preview limit is reasonable for inbox UI', () => {
    expect(STATEMENT_ANOMALY_PREVIEW_LIMIT).toBeGreaterThanOrEqual(3)
    expect(STATEMENT_ANOMALY_PREVIEW_LIMIT).toBeLessThanOrEqual(10)
  })
})

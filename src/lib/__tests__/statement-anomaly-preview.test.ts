import { describe, expect, it } from 'vitest'
import {
  STATEMENT_ANOMALY_STATUS_ORDER,
  STATEMENT_ANOMALY_STATUSES,
} from '@/lib/statement-anomaly-preview'

describe('statement-anomaly-preview', () => {
  it('covers all anomaly statuses in display order', () => {
    expect(STATEMENT_ANOMALY_STATUS_ORDER).toHaveLength(STATEMENT_ANOMALY_STATUSES.length)
    for (const s of STATEMENT_ANOMALY_STATUSES) {
      expect(STATEMENT_ANOMALY_STATUS_ORDER).toContain(s)
    }
  })
})

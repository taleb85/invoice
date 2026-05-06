import { describe, expect, it } from 'vitest'
import { documentDateYmdFromOcr } from '@/lib/safe-date'

describe('documentDateYmdFromOcr', () => {
  it('prefers data_fattura over legacy data', () => {
    expect(
      documentDateYmdFromOcr({
        data_fattura: '2026-04-15',
        data: '2026-01-01',
      }),
    ).toBe('2026-04-15')
  })

  it('falls back to data when data_fattura missing', () => {
    expect(documentDateYmdFromOcr({ data_fattura: null, data: '29/04/2026' })).toBe('2026-04-29')
  })

  it('returns null when neither field parses', () => {
    expect(documentDateYmdFromOcr({ data_fattura: '', data: null })).toBe(null)
  })
})

import { describe, expect, it } from 'vitest'
import { buildSupplierInboxSearchTerms } from '@/lib/fornitore-inbox-email-discovery'

describe('buildSupplierInboxSearchTerms', () => {
  it('derives short name and token pair from legal name', () => {
    const terms = buildSupplierInboxSearchTerms('Cici Cibo Limited')
    expect(terms).toContain('Cici Cibo Limited')
    expect(terms).toContain('Cici Cibo')
  })

  it('includes display name when provided', () => {
    const terms = buildSupplierInboxSearchTerms('Thames Valley Oils Ltd', 'TVO')
    expect(terms.some((t) => t.includes('Thames Valley'))).toBe(true)
  })

  it('returns empty for very short names', () => {
    expect(buildSupplierInboxSearchTerms('AB')).toEqual([])
  })
})

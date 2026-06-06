import { describe, expect, it } from 'vitest'
import {
  isSharedBillingPlatformSenderEmail,
  resolveFornitoreFromScanEmail,
  listSharedBillingPlatformEmailPatterns,
  listSharedBillingPlatformImapFromTerms,
} from '@/lib/fornitore-resolve-scan-email'
import { fornitoreNomeMatchesOcr } from '@/lib/fornitore-cross-check'

describe('isSharedBillingPlatformSenderEmail', () => {
  it('detects Xero billing platform senders', () => {
    expect(isSharedBillingPlatformSenderEmail('messaging-service@post.xero.com')).toBe(true)
    expect(isSharedBillingPlatformSenderEmail('noreply@post.xero.com')).toBe(true)
  })

  it('does not flag normal supplier domains', () => {
    expect(isSharedBillingPlatformSenderEmail('accounts@carnevale.co.uk')).toBe(false)
    expect(isSharedBillingPlatformSenderEmail('ordini@stellacoffee.com')).toBe(false)
  })
})

describe('fornitoreNomeMatchesOcr', () => {
  it('matches similar supplier names', () => {
    expect(fornitoreNomeMatchesOcr('Thames Valley Oils Ltd', 'Thames Valley Oils Limited')).toBe(true)
  })

  it('rejects clearly different suppliers', () => {
    expect(fornitoreNomeMatchesOcr('Thames Valley Oils Ltd', 'Cici Cibo Limited')).toBe(false)
  })
})

describe('resolveFornitoreFromScanEmail', () => {
  it('returns null for shared platform senders without querying', async () => {
    const result = await resolveFornitoreFromScanEmail(
      {} as never,
      'messaging-service@post.xero.com',
      'sede-1',
    )
    expect(result).toBeNull()
  })
})

describe('listSharedBillingPlatformEmailPatterns', () => {
  it('includes Xero and Intuit domains', () => {
    const patterns = listSharedBillingPlatformEmailPatterns()
    expect(patterns).toContain('%@post.xero.com')
    expect(patterns).toContain('%@notification.intuit.com')
  })
})

describe('listSharedBillingPlatformImapFromTerms', () => {
  it('includes Xero messaging sender for IMAP FROM search', () => {
    const terms = listSharedBillingPlatformImapFromTerms()
    expect(terms).toContain('messaging-service@post.xero.com')
    expect(terms.some((t) => t.includes('post.xero.com'))).toBe(true)
  })
})

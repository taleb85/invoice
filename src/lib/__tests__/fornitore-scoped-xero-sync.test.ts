import { describe, expect, it } from 'vitest'
import { messageMatchesFornitore } from '@/lib/fornitore-inbox-email-discovery'
import { isSharedBillingPlatformSenderEmail } from '@/lib/fornitore-resolve-scan-email'

describe('fornitore scoped Xero sync matching', () => {
  it('matches Xero statement subject to Cici Cibo', () => {
    expect(
      messageMatchesFornitore(
        'Statement from Cici Cibo Ltd for Osteria Basilico',
        null,
        'Cici Cibo Limited',
      ),
    ).toBe(true)
  })

  it('does not match unrelated Xero statement', () => {
    expect(
      messageMatchesFornitore(
        'Statement from Thames Valley Oils Ltd for Client',
        null,
        'Cici Cibo Limited',
      ),
    ).toBe(false)
  })

  it('flags Xero as shared platform sender', () => {
    expect(isSharedBillingPlatformSenderEmail('messaging-service@post.xero.com')).toBe(true)
    expect(isSharedBillingPlatformSenderEmail('francodemennato@yahoo.co.uk')).toBe(false)
  })
})

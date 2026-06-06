import { describe, expect, it } from 'vitest'
import { shouldSkipEmailForScanBlacklist } from '@/lib/email-scan-blacklist'

describe('shouldSkipEmailForScanBlacklist', () => {
  const blacklist = new Set(['messaging-service@post.xero.com', 'noreply@uber.com'])

  it('never skips shared billing platform senders even if blacklisted', () => {
    expect(
      shouldSkipEmailForScanBlacklist(blacklist, 'messaging-service@post.xero.com'),
    ).toBe(false)
  })

  it('still skips normal blacklisted senders', () => {
    expect(shouldSkipEmailForScanBlacklist(blacklist, 'noreply@uber.com')).toBe(true)
  })
})

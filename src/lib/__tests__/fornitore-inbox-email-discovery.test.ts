import { describe, expect, it } from 'vitest'
import {
  buildSupplierInboxSearchTerms,
  emailRelatesToSupplierName,
  filterSupplierEmailSuggestions,
  isLikelyMarketingMailboxEmail,
  messageMatchesFornitoreForInboxDiscovery,
} from '@/lib/fornitore-inbox-email-discovery'

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

  it('does not add generic-only token pairs like Catering Supplies', () => {
    const terms = buildSupplierInboxSearchTerms('V & S Catering Supplies Ltd')
    expect(terms).toContain('V & S Catering Supplies Ltd')
    expect(terms).toContain('V & S Catering Supplies')
    expect(terms).not.toContain('Catering Supplies')
  })
})

describe('messageMatchesFornitoreForInboxDiscovery', () => {
  const nome = 'V & S Catering Supplies Ltd'

  it('accepts Xero statement subject', () => {
    expect(
      messageMatchesFornitoreForInboxDiscovery(
        'Statement from V & S Catering Supplies Limited for Osteria Basilico',
        null,
        nome,
      ),
    ).toBe(true)
  })

  it('rejects generic catering newsletter subject', () => {
    expect(
      messageMatchesFornitoreForInboxDiscovery(
        'Weekly deals on catering supplies for your restaurant',
        'Buzz Newsletter',
        nome,
      ),
    ).toBe(false)
  })

  it('rejects spoofed display name without supplier in subject', () => {
    expect(
      messageMatchesFornitoreForInboxDiscovery(
        'Weekly deals on catering supplies',
        'V & S Catering Supplies Ltd',
        nome,
      ),
    ).toBe(false)
  })

  it('accepts invoice subject with full supplier name', () => {
    expect(
      messageMatchesFornitoreForInboxDiscovery(
        'Invoice INV-31481 from V & S Catering Supplies Limited for Osteria Basilico',
        null,
        nome,
      ),
    ).toBe(true)
  })
})

describe('isLikelyMarketingMailboxEmail', () => {
  it('flags newsletter senders', () => {
    expect(isLikelyMarketingMailboxEmail('newsletter@buzznewsletter.co.uk')).toBe(true)
  })

  it('allows supplier mailbox', () => {
    expect(isLikelyMarketingMailboxEmail('info@vandscateringsupplies.co.uk')).toBe(false)
  })
})

describe('emailRelatesToSupplierName', () => {
  const nome = 'V & S Catering Supplies Ltd'

  it('matches supplier domain email', () => {
    expect(emailRelatesToSupplierName('info@vandscateringsupplies.co.uk', nome)).toBe(true)
  })

  it('matches yahoo local-part from letterhead', () => {
    expect(emailRelatesToSupplierName('vandscatering@yahoo.com', nome)).toBe(true)
  })

  it('rejects unrelated newsletter sender', () => {
    expect(emailRelatesToSupplierName('newsletter@buzznewsletter.co.uk', nome)).toBe(false)
  })

  it('does not match acronym domain reply-to (handled via billing Reply-To path)', () => {
    expect(emailRelatesToSupplierName('accounts@slf-uk.com', 'Saggiomo Luxury Foods Ltd')).toBe(false)
  })
})

describe('filterSupplierEmailSuggestions — billing Reply-To', () => {
  it('keeps Xero reply-to on matched supplier mail (Saggiomo slf-uk.com)', () => {
    const out = filterSupplierEmailSuggestions(
      [
        {
          email: 'accounts@slf-uk.com',
          source: 'inbox_reply_to',
          count: 4,
          last_seen: '2026-06-06T00:00:00Z',
        },
      ],
      { nome: 'Saggiomo Luxury Foods Ltd' },
    )
    expect(out.map((s) => s.email)).toEqual(['accounts@slf-uk.com'])
  })

  it('keeps personal Yahoo reply-to on matched Xero mail (Cici Cibo)', () => {
    const out = filterSupplierEmailSuggestions(
      [
        {
          email: 'francodemennato@yahoo.co.uk',
          source: 'inbox_reply_to',
          count: 3,
          last_seen: '2026-06-06T00:00:00Z',
        },
      ],
      { nome: 'Cici Cibo Ltd' },
    )
    expect(out.map((s) => s.email)).toEqual(['francodemennato@yahoo.co.uk'])
  })
})

describe('filterSupplierEmailSuggestions', () => {
  const fornitore = { nome: 'V & S Catering Supplies Ltd' }

  it('drops marketing inbox suggestions', () => {
    const out = filterSupplierEmailSuggestions(
      [
        {
          email: 'newsletter@buzznewsletter.co.uk',
          source: 'inbox_from',
          count: 3,
          last_seen: '2026-06-06T00:00:00Z',
        },
        {
          email: 'info@vandscateringsupplies.co.uk',
          source: 'inbox_reply_to',
          count: 2,
          last_seen: '2026-06-06T00:00:00Z',
        },
      ],
      fornitore,
    )
    expect(out.map((s) => s.email)).toEqual(['info@vandscateringsupplies.co.uk'])
  })
})

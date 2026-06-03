import { describe, expect, it } from 'vitest'
import { auditMittenteMatchesFornitoreScope } from '@/lib/audit-fornitore-match'

describe('auditMittenteMatchesFornitoreScope', () => {
  const fid = 'fornitore-1'

  it('matches same exact email', () => {
    expect(
      auditMittenteMatchesFornitoreScope(
        'noreply@carnevale.co.uk',
        fid,
        fid,
        'noreply@carnevale.co.uk',
      ),
    ).toBe(true)
  })

  it('matches same corporate domain when reference is accounts@', () => {
    expect(
      auditMittenteMatchesFornitoreScope(
        'noreply@carnevale.co.uk',
        fid,
        fid,
        'accounts@carnevale.co.uk',
      ),
    ).toBe(true)
  })

  it('does not match different fornitore', () => {
    expect(
      auditMittenteMatchesFornitoreScope(
        'noreply@carnevale.co.uk',
        fid,
        'other-fornitore',
        'accounts@carnevale.co.uk',
      ),
    ).toBe(false)
  })

  it('does not match generic gmail domain across addresses', () => {
    expect(
      auditMittenteMatchesFornitoreScope(
        'b@gmail.com',
        fid,
        fid,
        'a@gmail.com',
      ),
    ).toBe(false)
  })
})

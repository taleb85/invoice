import { describe, expect, it } from 'vitest'
import {
  extractStatementFromSupplierName,
  statementEmailSubjectMatchesFornitore,
} from '@/lib/statement-supplier-subject'

describe('statement-supplier-subject', () => {
  it('estrae il nome dal pattern Statement from', () => {
    expect(extractStatementFromSupplierName('Statement from Clockwork Coffee Ltd')).toBe(
      'Clockwork Coffee Ltd',
    )
  })

  it('esclude estratti con oggetto di altro fornitore', () => {
    expect(
      statementEmailSubjectMatchesFornitore(
        'Statement from Saggiomo Luxury Foods Ltd',
        'CLOCKWORK COFFEE LTD',
      ),
    ).toBe(false)
    expect(
      statementEmailSubjectMatchesFornitore(
        'Statement from Clockwork Coffee Ltd',
        'CLOCKWORK COFFEE LTD',
      ),
    ).toBe(true)
  })
})

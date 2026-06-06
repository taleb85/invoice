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

  it('rimuove il suffisso «for cliente» dall\'oggetto', () => {
    expect(
      extractStatementFromSupplierName(
        'Statement from V & S Catering Supplies Limited for Osteria Basilico',
      ),
    ).toBe('V & S Catering Supplies Limited')
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

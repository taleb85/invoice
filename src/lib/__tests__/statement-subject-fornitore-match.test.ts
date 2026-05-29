import { describe, expect, it } from 'vitest'
import { extractStatementFromSupplierName } from '@/lib/statement-supplier-subject'

describe('statement subject fornitore extraction', () => {
  it('estrae Saggiomo e Clockwork dagli oggetti tipici', () => {
    expect(extractStatementFromSupplierName('Statement from Saggiomo Luxury Foods Ltd')).toBe(
      'Saggiomo Luxury Foods Ltd',
    )
    expect(extractStatementFromSupplierName('Statement from Clockwork Coffee Ltd')).toBe(
      'Clockwork Coffee Ltd',
    )
  })
})

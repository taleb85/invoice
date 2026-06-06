import { describe, expect, it } from 'vitest'
import { auditSupplierNamesMismatch } from '@/lib/inbox-audit-fornitore-suggest'

describe('auditSupplierNamesMismatch', () => {
  it('flags True Terroir vs Saggiomo from filename', () => {
    expect(
      auditSupplierNamesMismatch('True Terroir Ltd', 'Saggiomo Luxury Foods Ltd'),
    ).toBe(true)
  })

  it('allows same supplier with different suffix', () => {
    expect(auditSupplierNamesMismatch('Saggiomo Luxury Foods Ltd', 'Saggiomo Luxury Foods')).toBe(
      false,
    )
  })
})

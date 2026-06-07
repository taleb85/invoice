import { describe, expect, it } from 'vitest'
import { extractDocTypeLabel } from '@/lib/extract-doc-type'

describe('extractDocTypeLabel — QuickBooks receipt filenames', () => {
  it('labels Receipt__from_* as Payment Receipt, not Invoice', () => {
    expect(
      extractDocTypeLabel('9262', 'Receipt__from_True_Terroir_Ltd.pdf'),
    ).toBe('Payment Receipt')
  })
})

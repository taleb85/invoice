import { describe, expect, it } from 'vitest'
import {
  extractSupplierHintFromDocContext,
  extractSupplierNameFromAttachmentFileName,
} from '@/lib/extract-supplier-from-filename'

describe('extractSupplierNameFromAttachmentFileName', () => {
  it('parses QuickBooks invoice filename', () => {
    expect(
      extractSupplierNameFromAttachmentFileName(
        'Invoice_43284_from_Saggiomo_Luxury_Foods_Ltd.pdf',
      ),
    ).toBe('Saggiomo Luxury Foods Ltd')
  })

  it('parses statement-style filename', () => {
    expect(
      extractSupplierNameFromAttachmentFileName('Statement_from_Clockwork_Coffee_Ltd.pdf'),
    ).toBe('Clockwork Coffee Ltd')
  })
})

describe('extractSupplierHintFromDocContext', () => {
  it('prefers filename over metadata', () => {
    expect(
      extractSupplierHintFromDocContext(
        'Invoice_43284_from_Saggiomo_Luxury_Foods_Ltd.pdf',
        'Invoice from True Terroir Ltd',
        { ragione_sociale: 'True Terroir Ltd' },
      ),
    ).toBe('Saggiomo Luxury Foods Ltd')
  })
})

import { describe, expect, it } from 'vitest'
import { pickFornitoreCorrectionCandidateName } from '@/lib/fattura-fornitore-reassign-from-doc'

describe('pickFornitoreCorrectionCandidateName', () => {
  it('prefers QuickBooks filename hint over current supplier', () => {
    expect(
      pickFornitoreCorrectionCandidateName('True Terroir Ltd', {
        fileName: 'Invoice_43284_from_Saggiomo_Luxury_Foods_Ltd.pdf',
        emailSubject: 'Invoice 43284 from Saggiomo Luxury Foods Ltd',
        ocrRagioneSociale: 'True Terroir Ltd',
        mittente: 'quickbooks@notification.intuit.com',
      }),
    ).toBe('Saggiomo Luxury Foods Ltd')
  })

  it('returns null when filename and OCR match current supplier', () => {
    expect(
      pickFornitoreCorrectionCandidateName('Saggiomo Luxury Foods Ltd', {
        fileName: 'Invoice_43284_from_Saggiomo_Luxury_Foods_Ltd.pdf',
        ocrRagioneSociale: 'Saggiomo Luxury Foods Ltd',
      }),
    ).toBeNull()
  })

  it('uses OCR ragione sociale when platform sender contradicts assignment', () => {
    expect(
      pickFornitoreCorrectionCandidateName('True Terroir Ltd', {
        fileName: 'invoice.pdf',
        ocrRagioneSociale: 'Saggiomo Luxury Foods Ltd',
        mittente: 'quickbooks@notification.intuit.com',
      }),
    ).toBe('Saggiomo Luxury Foods Ltd')
  })
})

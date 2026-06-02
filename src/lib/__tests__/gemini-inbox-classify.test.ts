import { describe, expect, it } from 'vitest'
import { coerceInboxTipoFromSignals } from '@/lib/inbox-ai-tipo-coerce'

describe('coerceInboxTipoFromSignals', () => {
  it('maps Sales Order Confirmation filename from altro to ordine', () => {
    const r = coerceInboxTipoFromSignals(
      'Sales Order Confirmation-1284305.pdf',
      'altro',
      0.9,
      'Generic memo',
      null,
    )
    expect(r.tipo_suggerito).toBe('ordine')
    expect(r.confidenza).toBeGreaterThanOrEqual(0.93)
  })

  it('keeps fattura when already classified', () => {
    const r = coerceInboxTipoFromSignals('invoice-123.pdf', 'fattura', 0.95, '—', null)
    expect(r.tipo_suggerito).toBe('fattura')
  })

  it('does not coerce quotation to ordine', () => {
    const r = coerceInboxTipoFromSignals(
      'UntitledDocument.pdf',
      'ordine',
      0.9,
      'Sales Quotation for customer',
      null,
    )
    expect(r.tipo_suggerito).toBe('altro')
  })

  it('does not coerce CV to ordine', () => {
    const r = coerceInboxTipoFromSignals(
      'Mario_Rossi_CV.pdf',
      'altro',
      0.9,
      'Curriculum vitae',
      null,
    )
    expect(r.tipo_suggerito).toBe('altro')
  })
})

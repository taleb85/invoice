import { describe, expect, it } from 'vitest'
import { normalizeTipoDocumento, ocrTipoAllowsEmailAutoFattura } from '@/lib/ocr-tipo-documento'

describe('ocrTipoAllowsEmailAutoFattura', () => {
  it('allows only explicit invoice classification', () => {
    expect(ocrTipoAllowsEmailAutoFattura('fattura')).toBe(true)
    expect(ocrTipoAllowsEmailAutoFattura('Tax Invoice')).toBe(true)
    expect(ocrTipoAllowsEmailAutoFattura(null)).toBe(false)
    expect(ocrTipoAllowsEmailAutoFattura('')).toBe(false)
    expect(ocrTipoAllowsEmailAutoFattura('delivery_note')).toBe(false)
    expect(ocrTipoAllowsEmailAutoFattura('bolla')).toBe(false)
    expect(ocrTipoAllowsEmailAutoFattura('preventivo')).toBe(false)
    expect(ocrTipoAllowsEmailAutoFattura('curriculum')).toBe(false)
  })

  it('aligns with normalizeTipoDocumento for invoice synonyms', () => {
    const raw = 'commercial_invoice'
    expect(normalizeTipoDocumento(raw)).toBe('fattura')
    expect(ocrTipoAllowsEmailAutoFattura(raw)).toBe(true)
  })
})

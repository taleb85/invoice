import { describe, expect, it } from 'vitest'
import {
  importoForBollaFromOcr,
  normalizeTipoDocumento,
  ocrTipoAllowsEmailAutoFattura,
  shouldClearBollaImportoAfterBollaDdtReocr,
} from '@/lib/ocr-tipo-documento'

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

describe('importoForBollaFromOcr', () => {
  it('never copies OCR total onto bolle', () => {
    expect(
      importoForBollaFromOcr({ tipo_documento: 'bolla_ddt', totale_iva_inclusa: 140.8 })
    ).toBeNull()
    expect(
      importoForBollaFromOcr({ tipo_documento: 'fattura', totale_iva_inclusa: 99 })
    ).toBeNull()
  })
})

describe('shouldClearBollaImportoAfterBollaDdtReocr', () => {
  it('clears only when tipo is DDT and row has importo', () => {
    expect(shouldClearBollaImportoAfterBollaDdtReocr('bolla_ddt', 140.8)).toBe(true)
    expect(shouldClearBollaImportoAfterBollaDdtReocr('fattura', 140.8)).toBe(false)
    expect(shouldClearBollaImportoAfterBollaDdtReocr('bolla_ddt', null)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  formatBollaQuantita,
  quantitaForBollaFromOcr,
  quantitaForBollaFromOcrOrText,
  quantitaFromDocMetadata,
  sumDeliveryNoteQuantitaFromText,
} from '@/lib/bolla-quantita'

describe('quantitaForBollaFromOcr', () => {
  it('returns quantity for bolla_ddt only', () => {
    expect(quantitaForBollaFromOcr({ tipo_documento: 'bolla_ddt', quantita_totale: 12 })).toBe(12)
    expect(quantitaForBollaFromOcr({ tipo_documento: 'fattura', quantita_totale: 12 })).toBeNull()
  })
})

describe('quantitaFromDocMetadata', () => {
  it('sums rekki line quantities', () => {
    expect(
      quantitaFromDocMetadata({
        rekki_lines: [{ quantita: 3 }, { quantita: 2.5 }],
      }),
    ).toBe(5.5)
  })
})

describe('sumDeliveryNoteQuantitaFromText', () => {
  it('sums Case/Each and weight-line pack qty on UK delivery notes', () => {
    const sdn698804 = `Sales Delivery Note
CH565 FIORDILATTE MOZZ. 1.00 Case 80.60
PT009 PEELED TOMATOES 1.00 Case 18.50
SP165 FINE SALT 1.00 Each 11.40
WN254 COOKING WINE RED 1.00 Each 13.90
WN259 COOKING WINE WHITE 1.00 Each 13.90`
    expect(sumDeliveryNoteQuantitaFromText(sdn698804)).toBe(5)

    const sdn696539 = `Sales Delivery Note
NE175 PROSC COTTO 1.00 4.610 KG 13.40
SL405 SPIANATA 2.00 4.000 KG 11.90
PT009 PEELED TOMATOES 4.00 Case 18.50`
    expect(sumDeliveryNoteQuantitaFromText(sdn696539)).toBe(7)
  })
})

describe('quantitaForBollaFromOcrOrText', () => {
  it('falls back to PDF text when OCR qty is missing', () => {
    const text = 'Sales Delivery Note\nPT009 TOMATOES 4.00 Case 18.50'
    expect(quantitaForBollaFromOcrOrText({ tipo_documento: 'bolla_ddt' }, text)).toBe(4)
  })
})

describe('formatBollaQuantita', () => {
  it('formats or em dash', () => {
    expect(formatBollaQuantita(10.5, 'en-GB')).toMatch(/10/)
    expect(formatBollaQuantita(null, 'en-GB')).toBe('—')
  })
})

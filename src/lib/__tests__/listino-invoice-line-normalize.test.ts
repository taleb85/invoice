import { describe, expect, it } from 'vitest'
import {
  inferCodiceFromProductName,
  mergeImportLinesWithPdfText,
  normalizeListinoImportLineItem,
  parseInvoiceOrderQuantity,
  parseInvoiceTableLinesFromText,
  resolveAmbiguousInvoiceLinePrice,
  resolveListinoUnitPriceForDisplay,
  resolveUnitPriceFromInvoiceValue,
  sanitizeListinoProductName,
} from '@/lib/listino-invoice-line-normalize'

describe('sanitizeListinoProductName', () => {
  it('strips leading slash-separated SKU codes', () => {
    expect(
      sanitizeListinoProductName(
        'CFB128E /CF14BE MIDI BLUE C-FEED ROLL EMBOSSED',
        'TOWE02N',
      ),
    ).toBe('MIDI BLUE C-FEED ROLL EMBOSSED')
  })
})

describe('parseInvoiceOrderQuantity', () => {
  it('does not treat X6 pack format as order quantity', () => {
    expect(parseInvoiceOrderQuantity(null, 'X6')).toBeNull()
  })

  it('reads explicit invoice quantity', () => {
    expect(parseInvoiceOrderQuantity(2, 'X6')).toBe(2)
    expect(parseInvoiceOrderQuantity(null, '2 casse')).toBe(2)
  })
})

describe('resolveUnitPriceFromInvoiceValue', () => {
  it('divides Value column by Quantity (TOWE02N)', () => {
    const r = resolveUnitPriceFromInvoiceValue(17.98, 2, null)
    expect(r.unit).toBe(8.99)
    expect(r.lineTotal).toBe(17.98)
  })

  it('keeps price when already unit with importo_linea', () => {
    const r = resolveUnitPriceFromInvoiceValue(8.99, 2, 17.98)
    expect(r.unit).toBe(8.99)
  })

  it('does not treat doubled importo as unit price (Gemini prezzo=Value)', () => {
    const r = resolveUnitPriceFromInvoiceValue(17.98, 2, 35.96)
    expect(r.unit).toBe(17.98)
  })

  it('FOIL45: 2 rolls, value 13.18 → unit 6.59', () => {
    const r = resolveUnitPriceFromInvoiceValue(13.18, 2, null)
    expect(r.unit).toBe(6.59)
  })

  it('ZZCLIN01: 6 rolls, value 23.40 → unit 3.90', () => {
    const r = resolveUnitPriceFromInvoiceValue(23.4, 6, null)
    expect(r.unit).toBe(3.9)
  })

  it('non divide unitario 3,50 quando manca importo_linea e qty OCR è alta', () => {
    const r = resolveUnitPriceFromInvoiceValue(3.5, 16, null)
    expect(r.unit).toBe(3.5)
    expect(r.lineTotal).toBe(56)
  })
})

describe('resolveAmbiguousInvoiceLinePrice', () => {
  it('uses Value in prezzo when importo was doubled (no hist)', () => {
    const r = resolveAmbiguousInvoiceLinePrice(17.98, 2, 35.96)
    expect(r.unit).toBe(8.99)
    expect(r.lineTotal).toBe(17.98)
  })

  it('keeps unit when prezzo already correct (via listino)', () => {
    const r = resolveAmbiguousInvoiceLinePrice(8.99, 2, 17.98, [8.99, 9.1])
    expect(r.unit).toBe(8.99)
    expect(r.lineTotal).toBe(17.98)
  })

  it('picks unit matching listino when hist differs from wrong OCR', () => {
    const r = resolveAmbiguousInvoiceLinePrice(17.98, 2, 35.96, [8.99, 9.1])
    expect(r.unit).toBe(8.99)
  })
})

describe('parseInvoiceTableLinesFromText (Qty · Pack · Value)', () => {
  it('parses Del Italia style rows from invoice', () => {
    const text = `
TOWE02N CFB128E /CF14BE MIDI BLUE C-FEED ROLL EMBOSSED 2.00 X6 17.98
FOIL45 45cm X 75M CATERING FOIL 23C05 11mu 2.00 ROLL 13.18
MW8000 M8000B BLACK M/WAVEABLE CONT 880cc 1.00 X400 62.99
ZZCLIN01 CLING FILM 300mm X 300M PROWRAP 6.00 ROLL 23.40
`
    const lines = parseInvoiceTableLinesFromText(text)
    const tow = lines.find((l) => l.codice_prodotto === 'TOWE02N')
    const foil = lines.find((l) => l.codice_prodotto === 'FOIL45')
    const zz = lines.find((l) => l.codice_prodotto === 'ZZCLIN01')
    expect(tow?.prezzo).toBe(8.99)
    expect(tow?.importo_linea).toBe(17.98)
    expect(tow?.unita).toBe('X6')
    expect(foil?.prezzo).toBe(6.59)
    expect(zz?.prezzo).toBe(3.9)
  })

  it('parses tab-separated PDF rows', () => {
    const text =
      'TOWE02N\tCFB128E MIDI BLUE C-FEED ROLL EMBOSSED\t2.00\tX6\t17.98\n' +
      'FOIL45\t45cm X 75M CATERING FOIL\t2.00\tROLL\t13.18'
    const lines = parseInvoiceTableLinesFromText(text)
    expect(lines.find((l) => l.codice_prodotto === 'TOWE02N')?.prezzo).toBe(8.99)
    expect(lines.find((l) => l.codice_prodotto === 'FOIL45')?.prezzo).toBe(6.59)
  })
})

describe('mergeImportLinesWithPdfText', () => {
  it('fixes gemini when Value was taken as unit price', () => {
    const merged = mergeImportLinesWithPdfText(
      [
        {
          prodotto: 'MIDI BLUE C-FEED ROLL EMBOSSED',
          codice_prodotto: 'TOWE02N',
          prezzo: 17.98,
          quantita: 2,
          unita: 'X6',
          note: null,
        },
        {
          prodotto: 'CATERING FOIL',
          codice_prodotto: 'FOIL45',
          prezzo: 13.18,
          quantita: 2,
          unita: 'ROLL',
          note: null,
        },
      ],
      parseInvoiceTableLinesFromText(
        'TOWE02N CFB128E /CF14BE MIDI BLUE C-FEED ROLL EMBOSSED 2.00 X6 17.98\nFOIL45 45cm X 75M CATERING FOIL 2.00 ROLL 13.18',
      ),
    )
    expect(merged[0]!.prezzo).toBe(8.99)
    expect(merged[0]!.importo_linea).toBe(17.98)
    expect(merged[1]!.prezzo).toBe(6.59)
  })
})

describe('inferCodiceFromProductName', () => {
  it('reads M8000TR3 prefix', () => {
    expect(inferCodiceFromProductName('M8000TR3 CLEAR FLAT LID')).toBe('M8000TR3')
  })
})

describe('normalizeListinoImportLineItem', () => {
  it('treats prezzo as Value÷Qty when only qty+pack from AI (no importo_linea)', () => {
    const r = normalizeListinoImportLineItem({
      prodotto: 'MIDI BLUE C-FEED ROLL EMBOSSED',
      codice_prodotto: 'TOWE02N',
      prezzo: 17.98,
      quantita: 2,
      importo_linea: null,
      unita: 'X6',
      note: null,
    })
    expect(r.prezzo).toBe(8.99)
    expect(r.importo_linea).toBe(17.98)
  })

  it('FOIL45: Value 13.18 for 2 rolls → unit 6.59 with listino ref', () => {
    const r = normalizeListinoImportLineItem(
      {
        prodotto: '45cm X 75M CATERING FOIL',
        codice_prodotto: 'FOIL45',
        prezzo: 13.18,
        quantita: 2,
        importo_linea: 26.36,
        unita: 'ROLL',
        note: 'lettura tabella PDF (Value÷Qty)',
      },
      [6.59],
    )
    expect(r.prezzo).toBe(6.59)
    expect(r.importo_linea).toBe(13.18)
  })

  it('ZZCLIN01: Value 23.40 for 6 rolls → unit 3.90 with listino ref', () => {
    const r = normalizeListinoImportLineItem(
      {
        prodotto: 'CLING FILM 300mm X 300M',
        codice_prodotto: 'ZZCLIN01',
        prezzo: 23.4,
        quantita: 6,
        importo_linea: 140.4,
        unita: 'ROLL',
        note: null,
      },
      [3.6],
    )
    expect(r.prezzo).toBe(3.9)
    expect(r.importo_linea).toBe(23.4)
  })

  it('fixes Gemini doubled importo_linea (TOWE02N)', () => {
    const r = normalizeListinoImportLineItem({
      prodotto: 'MIDI BLUE C-FEED ROLL EMBOSSED',
      codice_prodotto: 'TOWE02N',
      prezzo: 17.98,
      quantita: 2,
      importo_linea: 35.96,
      unita: 'X6',
      note: null,
    })
    expect(r.prezzo).toBe(8.99)
    expect(r.importo_linea).toBe(17.98)
  })

  it('divides line total by quantity when prezzo equals importo_linea', () => {
    const r = normalizeListinoImportLineItem({
      prodotto: 'TOWEL ROLL',
      codice_prodotto: 'TOWE02N',
      prezzo: 50,
      quantita: 2,
      importo_linea: 50,
      unita: 'X6',
      note: null,
    })
    expect(r.prezzo).toBe(25)
  })
})

describe('resolveListinoUnitPriceForDisplay — Hildon x 12', () => {
  const note = 'Codice: 75GC12 — Unità: x 12 — Qtà fattura: 3'

  it('keeps per-case price when history has low OCR outlier', () => {
    expect(resolveListinoUnitPriceForDisplay(37.44, note, [3.12, 3.12])).toBeCloseTo(37.44, 2)
    expect(resolveListinoUnitPriceForDisplay(37.44, note, [3.12, 37.44])).toBeCloseTo(37.44, 2)
  })

  it('does not divide by invoice order qty when prezzo is already per case', () => {
    expect(resolveListinoUnitPriceForDisplay(37.44, note, [37.44])).toBeCloseTo(37.44, 2)
  })

  it('still divides true line total by order qty', () => {
    expect(resolveListinoUnitPriceForDisplay(112.32, note, [37.44])).toBeCloseTo(37.44, 2)
  })
})

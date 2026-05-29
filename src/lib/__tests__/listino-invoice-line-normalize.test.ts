import { describe, expect, it } from 'vitest'
import {
  inferCodiceFromProductName,
  mergeImportLinesWithPdfText,
  normalizeListinoImportLineItem,
  parseInvoiceOrderQuantity,
  parseInvoiceTableLinesFromText,
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

describe('parseInvoiceTableLinesFromText', () => {
  it('parses qty, unit price and line total from PDF row', () => {
    const lines = parseInvoiceTableLinesFromText(
      'M8000B BLACK M WAVEABLE CONT 880cc  2  40.81  81.62\n',
    )
    expect(lines).toHaveLength(1)
    expect(lines[0]!.codice_prodotto).toBe('M8000B')
    expect(lines[0]!.quantita).toBe(2)
    expect(lines[0]!.prezzo).toBe(40.81)
    expect(lines[0]!.importo_linea).toBe(81.62)
  })
})

describe('mergeImportLinesWithPdfText', () => {
  it('replaces gemini line total with unit price from PDF table', () => {
    const merged = mergeImportLinesWithPdfText(
      [
        {
          prodotto: 'BLACK M WAVEABLE CONT 880cc',
          codice_prodotto: 'M8000B',
          prezzo: 81.62,
          unita: null,
          note: null,
        },
      ],
      parseInvoiceTableLinesFromText('M8000B BLACK M WAVEABLE CONT 880cc  2  40.81  81.62'),
    )
    expect(merged[0]!.prezzo).toBe(40.81)
    expect(merged[0]!.quantita).toBe(2)
  })
})

describe('inferCodiceFromProductName', () => {
  it('reads M8000TR3 prefix', () => {
    expect(inferCodiceFromProductName('M8000TR3 CLEAR FLAT LID')).toBe('M8000TR3')
  })
})

describe('normalizeListinoImportLineItem', () => {
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

  it('divides when prezzo is 2× an obvious unit with qty 2', () => {
    const r = normalizeListinoImportLineItem({
      prodotto: 'TOWEL ROLL',
      prezzo: 48.4,
      quantita: 2,
      unita: null,
      note: null,
    })
    expect(r.prezzo).toBe(24.2)
  })
})

import { describe, expect, it } from 'vitest'
import {
  normalizeListinoImportLineItem,
  parseInvoiceOrderQuantity,
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

import { describe, expect, it } from 'vitest'
import {
  documentDateYmdFromOcr,
  extractOrderDateFromLabelledText,
  orderDateYmdFromOcr,
} from '@/lib/safe-date'

describe('extractOrderDateFromLabelledText', () => {
  it('parses UK Order Date DD/MM/YYYY', () => {
    expect(extractOrderDateFromLabelledText('Order Date 01/04/2026 Despatch Date 02/04/2026')).toBe(
      '2026-04-01',
    )
  })
})

describe('orderDateYmdFromOcr', () => {
  it('prefers data_ordine over generic data_fattura', () => {
    expect(
      orderDateYmdFromOcr({
        data_ordine: '2026-04-01',
        data_fattura: '2026-06-01',
      }),
    ).toBe('2026-04-01')
  })
})

describe('documentDateYmdFromOcr ordine', () => {
  it('uses order date path for tipo ordine', () => {
    expect(
      documentDateYmdFromOcr(
        { tipo_documento: 'ordine', data_ordine: '2026-04-01', data_fattura: '2026-06-01' },
        null,
      ),
    ).toBe('2026-04-01')
  })
})

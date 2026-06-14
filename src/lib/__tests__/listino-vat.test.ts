import { describe, expect, it } from 'vitest'
import {
  applyListinoVatForDisplay,
  listinoPricesIncludeVat,
  listinoVatMultiplier,
} from '@/lib/listino-vat'

describe('listinoVatMultiplier', () => {
  it('UK/GB → 20%', () => {
    expect(listinoVatMultiplier('UK')).toBe(1.2)
    expect(listinoVatMultiplier('GB')).toBe(1.2)
  })

  it('IT → 22%', () => {
    expect(listinoVatMultiplier('IT')).toBe(1.22)
  })

  it('paese sconosciuto → nessuna IVA', () => {
    expect(listinoVatMultiplier('US')).toBe(1)
    expect(listinoVatMultiplier(null)).toBe(1)
  })
})

describe('applyListinoVatForDisplay', () => {
  it('aggiunge IVA UK a prezzo netto fattura', () => {
    expect(applyListinoVatForDisplay(8.81, 'UK')).toBe(10.57)
    expect(applyListinoVatForDisplay(52.86, 'UK')).toBe(63.43)
  })

  it('non modifica se sede senza moltiplicatore', () => {
    expect(applyListinoVatForDisplay(8.81, 'US')).toBe(8.81)
  })
})

describe('listinoPricesIncludeVat', () => {
  it('true per sedi EU/UK', () => {
    expect(listinoPricesIncludeVat('UK')).toBe(true)
    expect(listinoPricesIncludeVat('IT')).toBe(true)
  })

  it('false senza aliquota', () => {
    expect(listinoPricesIncludeVat('US')).toBe(false)
  })
})

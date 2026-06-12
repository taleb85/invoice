import { describe, expect, it } from 'vitest'
import {
  inferPackCountFromProductName,
  resolveComparableListinoPrice,
} from '@/lib/listino-compare-normalize'

describe('inferPackCountFromProductName', () => {
  it('parses 6/75 wine format', () => {
    expect(inferPackCountFromProductName('Gavi di Gavi Minaia 25-Bergaglio 6/75')).toBe(6)
  })

  it('returns null for single bottle names', () => {
    expect(inferPackCountFromProductName('Gavi di Gavi 2024 Bisio')).toBeNull()
  })
})

describe('resolveComparableListinoPrice', () => {
  it('keeps per-bottle price when already near search median', () => {
    const r = resolveComparableListinoPrice({
      prezzo: 10.25,
      note: null,
      prodotto: 'Gavi di Gavi Minaia 25-Bergaglio 6/75',
      otherPrices: [10.1, 10.3],
      searchMedianUnit: 10.5,
    })
    expect(r.prezzo_confronto).toBe(10.25)
    expect(r.prezzo_listino).toBe(10.25)
    expect(r.formato).toBe('singolo')
  })

  it('normalizes case price to per bottle using pack hint in note', () => {
    const r = resolveComparableListinoPrice({
      prezzo: 60.06,
      note: 'codice:123 · unita:6x75cl',
      prodotto: 'Gavi di Gavi Minaia 23 Bergaglio',
      otherPrices: [58.5, 61.2],
      searchMedianUnit: 10.5,
    })
    expect(r.prezzo_listino).toBe(60.06)
    expect(r.prezzo_confronto).toBe(10.01)
    expect(r.pack_size).toBe(6)
    expect(r.formato).toBe('confezione')
  })

  it('normalizes high case price using product name pack when median is known', () => {
    const r = resolveComparableListinoPrice({
      prezzo: 60.06,
      note: null,
      prodotto: 'Gavi di Gavi Minaia 23 Bergaglio 6/75',
      otherPrices: [60.06],
      searchMedianUnit: 11.5,
    })
    expect(r.prezzo_confronto).toBe(10.01)
    expect(r.prezzo_listino).toBe(60.06)
  })
})

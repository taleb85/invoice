import { describe, expect, it } from 'vitest'
import {
  inferPackCountFromProductName,
  normalizeCompareBatch,
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
  it('keeps per-bottle price when already near peer units', () => {
    const r = resolveComparableListinoPrice({
      prezzo: 10.25,
      note: 'Codice: 25366125 — Unità: 6/75cl',
      prodotto: 'Gavi di Gavi Minaia 25-Bergaglio 6/75',
      otherPrices: [10.25],
      peerUnitPrices: [10.44, 11.5],
    })
    expect(r.prezzo_confronto).toBe(10.25)
    expect(r.formato).toBe('singolo')
  })

  it('normalizes 6x75cl case price using peer bottle prices', () => {
    const r = resolveComparableListinoPrice({
      prezzo: 62.64,
      note: 'codice:25366125 · unita:6x75cl · per 6x75cl',
      prodotto: 'Gavi di Gavi Minaia 25 Bergaglio',
      otherPrices: [62.64, 61.5],
      peerUnitPrices: [10.25, 11.5],
    })
    expect(r.prezzo_listino).toBe(62.64)
    expect(r.prezzo_confronto).toBe(10.44)
    expect(r.pack_size).toBe(6)
    expect(r.formato).toBe('confezione')
  })
})

describe('normalizeCompareBatch', () => {
  it('normalizes mixed gavi search results together', () => {
    const rows = normalizeCompareBatch([
      {
        prezzo: 62.64,
        note: 'codice:25366125 · unita:6x75cl',
        prodotto: 'Gavi di Gavi Minaia 25 Bergaglio 6/75',
        otherPrices: [62.64],
      },
      {
        prezzo: 10.25,
        note: 'Codice: 25366125 — Unità: 6/75cl',
        prodotto: 'Gavi di Gavi Minaia 25-Bergaglio 6/75',
        otherPrices: [10.25],
      },
      {
        prezzo: 11.5,
        note: null,
        prodotto: 'Gavi di Gavi 2024 Bisio',
        otherPrices: [11.5],
      },
    ])

    expect(rows[0]!.prezzo_confronto).toBe(10.44)
    expect(rows[1]!.prezzo_confronto).toBe(10.25)
    expect(rows[2]!.prezzo_confronto).toBe(11.5)
  })
})

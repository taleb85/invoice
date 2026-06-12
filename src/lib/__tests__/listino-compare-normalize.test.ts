import { describe, expect, it } from 'vitest'
import {
  inferPackCountFromProductName,
  listinoPackagePriceForCompare,
  normalizeCompareBatch,
  normalizeCompareDisplayRows,
  repairUnderpricedRetailPackPrice,
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

describe('normalizeCompareDisplayRows', () => {
  it('splits stale API rows using unita 6x75cl', () => {
    const rows = normalizeCompareDisplayRows([
      {
        prodotto: 'Gavi di Gavi Minaia 25-Bergaglio 6/75',
        prezzo_attuale: 10.25,
        prezzo_listino: 10.25,
        prezzo_confronto: 10.25,
        unita: '6/75cl',
        formato: 'singolo',
      },
      {
        prodotto: 'Gavi di Gavi 2024 Bisio',
        prezzo_attuale: 11.5,
        prezzo_listino: 11.5,
        prezzo_confronto: 11.5,
        unita: 'pcs',
        formato: 'singolo',
      },
      {
        prodotto: 'Gavi di Gavi Minaia 23 Bergaglio',
        prezzo_attuale: 60.06,
        prezzo_listino: 60.06,
        prezzo_confronto: 60.06,
        unita: '6x75cl',
        formato: 'singolo',
      },
    ])

    expect(rows[2]!.prezzo_confezione).toBe(60.06)
    expect(rows[2]!.prezzo_unita).toBe(10.01)
    expect(rows[0]!.prezzo_confezione).toBe(10.25)
    expect(rows[0]!.prezzo_unita).toBe(10.25)
  })
})

describe('listinoPackagePriceForCompare', () => {
  it('non divide il prezzo confezione 250g per Qtà fattura OCR', () => {
    expect(
      listinoPackagePriceForCompare(
        3.5,
        'MOZZ. DI BUFALA TRECCIA 250 GR BAG',
        'Codice: ABC — Qtà fattura: 16 · unita: 250 GR BAG',
        [3.5, 3.6],
      ),
    ).toBe(3.5)
  })

  it('ripara prezzo listino 0,22 salvato per errore (3,50÷16)', () => {
    const note =
      'Unità: 250 GR BAG — Qtà fattura: 4 — Origine: Fattura 22806|listino_src_fattura:abc|'
    expect(
      repairUnderpricedRetailPackPrice(
        0.22,
        'MOZZ. DI BUFALA TRECCIA 250 GR BAG',
        note,
        [],
      ),
    ).toBe(3.52)

    const rows = normalizeCompareDisplayRows([
      {
        prodotto: 'MOZZ. DI BUFALA TRECCIA 250 GR BAG',
        prezzo_attuale: 0.22,
        prezzo_listino: 0.22,
        prezzo_confronto: 0.22,
        note,
        unita: '250 GR BAG',
        formato: 'singolo',
      },
    ])

    expect(rows[0]!.prezzo_confezione).toBe(3.52)
    expect(rows[0]!.prezzo_kg).toBe(14.08)
  })
})

describe('parseProductWeightKg', () => {
  it('calcola prezzo confezione e per kg per mozzarella 3kg', () => {
    const rows = normalizeCompareDisplayRows([
      {
        prodotto: '3kg Cubed Mozzarella Tray',
        prezzo_attuale: 19.35,
        prezzo_listino: 19.35,
        prezzo_confronto: 19.35,
        unita: null,
        formato: 'singolo',
      },
      {
        prodotto: 'Mozzarella di Bufala DOP 100g (Tre Stelle)',
        prezzo_attuale: 11.4,
        prezzo_listino: 11.4,
        prezzo_confronto: 11.4,
        unita: null,
        formato: 'singolo',
      },
      {
        prodotto: 'MOZZ. DI BUFALA TRECCIA 250 GR BAG',
        prezzo_attuale: 3.5,
        prezzo_listino: 3.5,
        prezzo_confronto: 3.5,
        note: 'Codice: ABC — Qtà fattura: 16 · unita: 250 GR BAG',
        unita: '250 GR BAG',
        formato: 'singolo',
      },
    ])

    expect(rows[0]!.peso_kg).toBe(3)
    expect(rows[0]!.prezzo_confezione).toBe(19.35)
    expect(rows[0]!.prezzo_kg).toBe(6.45)
    expect(rows[1]!.prezzo_kg).toBe(114)
    expect(rows[2]!.peso_kg).toBe(0.25)
    expect(rows[2]!.prezzo_confezione).toBe(3.5)
    expect(rows[2]!.prezzo_kg).toBe(14)
  })
})

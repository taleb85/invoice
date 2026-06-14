import { describe, expect, it } from 'vitest'
import {
  applyListinoVatForDisplay,
  finalizeListinoImportVatRate,
  formatListinoVatNote,
  isAlcoholListinoProduct,
  isLikelyZeroRatedFoodListinoProduct,
  listinoRowShowsVatInDisplay,
  listinoVatMultiplier,
  listinoVatMultiplierForRow,
  parseListinoVatRatePercent,
  resolveListinoVatRatePercent,
} from '@/lib/listino-vat'

describe('parseListinoVatRatePercent', () => {
  it('legge IVA dalla nota listino', () => {
    expect(parseListinoVatRatePercent('Codice: NE175 — IVA: 0%')).toBe(0)
    expect(parseListinoVatRatePercent('IVA: 20% — Origine: fattura')).toBe(20)
  })
})

describe('formatListinoVatNote', () => {
  it('formatta aliquota per salvataggio', () => {
    expect(formatListinoVatNote(0)).toBe('IVA: 0%')
    expect(formatListinoVatNote(20)).toBe('IVA: 20%')
    expect(formatListinoVatNote(null)).toBeNull()
  })
})

describe('isAlcoholListinoProduct', () => {
  it('riconosce vino e prosecco', () => {
    expect(isAlcoholListinoProduct('Prosecco Argeo NV Ruggeri 6/75')).toBe(true)
    expect(isAlcoholListinoProduct('Beer Menabrea Blonde 24x33cl')).toBe(true)
  })

  it('non classifica carne come alcol', () => {
    expect(isAlcoholListinoProduct('NEGRINI PROSC COTTO VALPADUSE 1/2 4kg')).toBe(false)
  })
})

describe('isLikelyZeroRatedFoodListinoProduct', () => {
  it('riconosce prosciutto venduto a kg', () => {
    expect(
      isLikelyZeroRatedFoodListinoProduct('NEGRINI PROSC COTTO VALPADUSE 1/2 4kg', 'KG'),
    ).toBe(true)
  })

  it('non classifica prosecco come zero-rated', () => {
    expect(isLikelyZeroRatedFoodListinoProduct('Prosecco Argeo NV Ruggeri 6/75', '6x75cl')).toBe(
      false,
    )
  })
})

describe('resolveListinoVatRatePercent', () => {
  it('usa la nota se presente', () => {
    expect(resolveListinoVatRatePercent('UK', { note: 'IVA: 0%' })).toBe(0)
  })

  it('UK: alimenti a kg spesso 0%, alcol 20%', () => {
    expect(
      resolveListinoVatRatePercent('UK', {
        prodotto: 'NEGRINI PROSC COTTO VALPADUSE 1/2 4kg',
        unita: 'KG',
      }),
    ).toBe(0)
    expect(
      resolveListinoVatRatePercent('UK', {
        prodotto: 'Prosecco Argeo NV Ruggeri 6/75',
        unita: '6x75cl',
      }),
    ).toBe(20)
  })
})

describe('applyListinoVatForDisplay', () => {
  it('aggiunge IVA UK solo su prodotti tassati', () => {
    expect(applyListinoVatForDisplay(8.81, 'UK', { prodotto: 'Prosecco Argeo NV' })).toBe(10.57)
    expect(
      applyListinoVatForDisplay(16.21, 'UK', {
        prodotto: 'NEGRINI PROSC COTTO VALPADUSE 1/2 4kg',
        unita: 'KG',
      }),
    ).toBe(16.21)
  })

  it('rispetta IVA: 0% in nota', () => {
    expect(
      applyListinoVatForDisplay(16.21, 'UK', {
        note: 'IVA: 0%',
        prodotto: 'Some ambiguous product',
      }),
    ).toBe(16.21)
  })
})

describe('listinoRowShowsVatInDisplay', () => {
  it('nasconde etichetta IVA inclusa su zero-rated', () => {
    expect(
      listinoRowShowsVatInDisplay('UK', {
        prodotto: 'NEGRINI PROSC COTTO VALPADUSE 1/2 4kg',
        unita: 'KG',
      }),
    ).toBe(false)
    expect(listinoRowShowsVatInDisplay('UK', { prodotto: 'Prosecco Argeo NV' })).toBe(true)
  })
})

describe('finalizeListinoImportVatRate', () => {
  it('preferisce aliquota estratta dall’AI', () => {
    expect(
      finalizeListinoImportVatRate(
        { prodotto: 'Prosecco', unita: '6x75cl', aliquota_iva: 0 },
        'UK',
      ),
    ).toBe(0)
  })
})

describe('listinoVatMultiplier', () => {
  it('UK/GB → 20%', () => {
    expect(listinoVatMultiplier('UK')).toBe(1.2)
    expect(listinoVatMultiplier('GB')).toBe(1.2)
  })
})

describe('listinoVatMultiplierForRow', () => {
  it('moltiplicatore 1 su zero-rated', () => {
    expect(
      listinoVatMultiplierForRow('UK', {
        prodotto: 'NEGRINI PROSC COTTO VALPADUSE 1/2 4kg',
        unita: 'KG',
      }),
    ).toBe(1)
  })
})

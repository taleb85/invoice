import { describe, expect, it } from 'vitest'
import {
  buildListinoByProduct,
  listinoProductEntriesByLatestDateDesc,
  listinoDisplayLabelForGroup,
  listinoGroupAliasNames,
  listinoGroupAliasNamesForDisplay,
  listinoCodiceShownInTitle,
  listinoNoteTailForDisplay,
  listinoGroupKey,
  parseListinoNoteParts,
  isNonProductListinoRow,
  isPromoListinoRow,
  filterOutliersForTrend,
  displayListinoUnitPrice,
  listinoPerPiecePriceHint,
  isListinoCaseUnitFormat,
  parsePackSizeFromListinoUnita,
  pickDisplayListinoRow,
  dynamicStaleThresholdDays,
  formatListinoPriceChangePct,
  productNamesMatchForVerifica,
  checkResultMatchesVerificaProdotto,
  resolveVerificaDisplayRows,
} from '@/lib/listino-display'

describe('parseListinoNoteParts', () => {
  it('returns null fields for empty/null note', () => {
    expect(parseListinoNoteParts(null)).toEqual({ codice: null, unita: null, humanTail: null })
    expect(parseListinoNoteParts('')).toEqual({ codice: null, unita: null, humanTail: null })
    expect(parseListinoNoteParts('   ')).toEqual({ codice: null, unita: null, humanTail: null })
  })

  it('parses the legacy capitalized em-dash format from manual import', () => {
    const r = parseListinoNoteParts('Codice: 61025 — Unità: 24x33cl — promo Natale')
    expect(r.codice).toBe('61025')
    expect(r.unita).toBe('24x33cl')
    expect(r.humanTail).toBe('promo Natale')
  })

  it('parses the OCR auto-import lowercase mid-dot format', () => {
    const r = parseListinoNoteParts('codice:61025 · unita:24x33cl · per 24x33cl')
    expect(r.codice).toBe('61025')
    expect(r.unita).toBe('24x33cl')
    expect(r.humanTail).toBe('per 24x33cl')
  })

  it('strips the machine src-fattura suffix before parsing', () => {
    const r = parseListinoNoteParts(
      'codice:61025 · unita:24x33cl · |listino_src_fattura:f2fef5c0-fa14-4daf-8389-52a99eb48e27|',
    )
    expect(r.codice).toBe('61025')
    expect(r.unita).toBe('24x33cl')
    expect(r.humanTail).toBeNull()
  })

  it('accepts mixed-case labels and accented "Unità"', () => {
    const r = parseListinoNoteParts('CODICE: ABC-1 · Unità: 1Lt')
    expect(r.codice).toBe('ABC-1')
    expect(r.unita).toBe('1Lt')
  })

  it('keeps free-form parts when no recognized label is present', () => {
    const r = parseListinoNoteParts('promo · sconto 10% · ritiro in sede')
    expect(r.codice).toBeNull()
    expect(r.unita).toBeNull()
    expect(r.humanTail).toBe('promo · sconto 10% · ritiro in sede')
  })

  it('ignores empty values after label colon', () => {
    const r = parseListinoNoteParts('codice: · unita:24x33cl')
    expect(r.codice).toBeNull()
    expect(r.unita).toBe('24x33cl')
  })
})

describe('listino product grouping', () => {
  it('merges rows with same codice but different OCR product names', () => {
    const rows = [
      {
        prodotto: '500cc BLACK MICROWAVE CONTAINER & LIDS',
        note: 'Codice: MWB500 — per 250',
        data_prezzo: '2026-02-20',
      },
      {
        prodotto: '500cc BLACK MICROWAVE CONTAINER & LIDS RETURNS',
        note: 'Codice: MWB500 — Unità: each',
        data_prezzo: '2026-02-23',
      },
    ]
    expect(listinoGroupKey(rows[0]!)).toBe(listinoGroupKey(rows[1]!))
    const grouped = buildListinoByProduct(rows)
    const label = listinoDisplayLabelForGroup(rows)
    expect(Object.keys(grouped)).toHaveLength(1)
    expect(grouped[label]).toHaveLength(2)
    expect(listinoGroupAliasNames(rows, label).sort()).toEqual(
      [
        '500cc BLACK MICROWAVE CONTAINER & LIDS',
        '500cc BLACK MICROWAVE CONTAINER & LIDS RETURNS',
      ].sort(),
    )
  })

  it('keeps separate listino rows when OCR name is generic but codici differ', () => {
    const rows = [
      {
        prodotto: 'Goods/Services',
        note: 'codice:807131 · |listino_src_fattura:abc|',
        data_prezzo: '2025-06-30',
      },
      {
        prodotto: 'Goods/Services',
        note: 'codice:809302 · |listino_src_fattura:abc|',
        data_prezzo: '2025-06-30',
      },
    ]
    const grouped = buildListinoByProduct(rows)
    expect(Object.keys(grouped)).toHaveLength(2)
    expect(grouped['Goods/Services (807131)']).toHaveLength(1)
    expect(grouped['Goods/Services (809302)']).toHaveLength(1)
    expect(listinoDisplayLabelForGroup([rows[0]!])).toBe('Goods/Services (807131)')
  })

  it('orders product entries by latest data_prezzo descending', () => {
    const byProduct = buildListinoByProduct([
      { prodotto: 'Old Wine', note: 'codice:OLD1', data_prezzo: '2025-01-10' },
      { prodotto: 'New Wine', note: 'codice:NEW1', data_prezzo: '2026-03-19' },
      { prodotto: 'Mid Wine', note: 'codice:MID1', data_prezzo: '2025-08-05' },
      { prodotto: 'Mid Wine RETURNS', note: 'codice:MID1', data_prezzo: '2025-06-01' },
    ])
    expect(listinoProductEntriesByLatestDateDesc(byProduct).map(([name]) => name)).toEqual([
      'New Wine (NEW1)',
      'Mid Wine (MID1)',
      'Old Wine (OLD1)',
    ])
  })
})

describe('listinoGroupAliasNamesForDisplay', () => {
  it('drops aliases subsumed by the main display label', () => {
    const label = 'Chianti Classico 22 Castellani 6/75 (G7186122)'
    const rows = [
      { prodotto: label },
      { prodotto: 'Chianti Classico Castellani' },
      { prodotto: 'Chianti Classico 22 Castellani 6/75' },
    ]
    expect(listinoGroupAliasNamesForDisplay(rows, label)).toEqual([])
  })

  it('keeps meaningfully different OCR aliases', () => {
    const label = '500cc BLACK MICROWAVE CONTAINER & LIDS (MWB500)'
    const rows = [
      { prodotto: label },
      { prodotto: '500cc BLACK MICROWAVE CONTAINER & LIDS RETURNS' },
      { prodotto: 'MW CONTAINER 500cc BLACK' },
    ]
    expect(listinoGroupAliasNamesForDisplay(rows, label)).toEqual(['MW CONTAINER 500cc BLACK'])
  })
})

describe('listinoNoteTailForDisplay', () => {
  it('omits Origine when already shown as origin link', () => {
    const tail = 'Origine: Fattura SN8121977 — promo estate'
    expect(listinoNoteTailForDisplay(tail, { skipOrigin: true })).toBe('promo estate')
  })

  it('keeps Origine when skipOrigin is false', () => {
    const tail = 'Origine: Fattura SN8121977 — promo estate'
    expect(listinoNoteTailForDisplay(tail)).toBe('Origine: Fattura SN8121977 · promo estate')
  })

  it('returns null for empty tail', () => {
    expect(listinoNoteTailForDisplay(null)).toBeNull()
    expect(listinoNoteTailForDisplay('Origine: Fattura SN8121977', { skipOrigin: true })).toBeNull()
  })

  it('hides year-only OCR fragments', () => {
    expect(listinoNoteTailForDisplay('2026-')).toBeNull()
    expect(listinoNoteTailForDisplay('Origine: Fattura SN8121977 — 2026-', { skipOrigin: true })).toBeNull()
  })

  it('hides ISO date fragments already shown in the price column', () => {
    expect(listinoNoteTailForDisplay('2026-05-08')).toBeNull()
    expect(listinoNoteTailForDisplay('Origine: Fattura SN8121977 — 2026-05-08', { skipOrigin: true })).toBeNull()
    expect(listinoNoteTailForDisplay('promo estate — 2026-05-08')).toBe('promo estate')
  })
})

describe('listinoCodiceShownInTitle', () => {
  it('detects codice in product title', () => {
    expect(listinoCodiceShownInTitle('Chianti Classico (G7186122)', 'G7186122')).toBe(true)
    expect(listinoCodiceShownInTitle('Beer Menabrea 61025', '61025')).toBe(true)
    expect(listinoCodiceShownInTitle('Goods/Services', '807131')).toBe(false)
  })
})

describe('isNonProductListinoRow', () => {
  it('flags delivery / logistics OCR lines', () => {
    expect(
      isNonProductListinoRow({
        prodotto:
          'Delivery from 9 - 12 OR AFTER 3.00PM 02077279957. HANDBALL DROP. 10 CASE Drop Based On Sales Orders',
      }),
    ).toBe(true)
  })

  it('keeps regular catalog products', () => {
    expect(
      isNonProductListinoRow({
        prodotto: '750ml Hildon Still Glass x 12',
        note: 'Codice: 75GS12 — Unità: x 12',
      }),
    ).toBe(false)
  })

  it('keeps long wine descriptions without SKU in note (True Terroir)', () => {
    expect(
      isNonProductListinoRow({
        prodotto: 'LA VIGNA DI RIVA - Pinot Grigio Doc delle Venezie - 2023 - Italy - 6x75cl',
      }),
    ).toBe(false)
    const grouped = buildListinoByProduct([
      {
        id: '1',
        prodotto: 'LA VIGNA DI RIVA - Pinot Grigio Doc delle Venezie - 2023 - Italy - 6x75cl',
        prezzo: 8.3,
        data_prezzo: '2025-06-12',
        note: null,
      },
    ])
    expect(Object.keys(grouped)).toHaveLength(1)
  })
})

describe('buildListinoByProduct excludes non-products', () => {
  it('omits delivery instructions from grouped listino', () => {
    const rows = [
      {
        prodotto: 'Beer Menabrea',
        note: 'codice:61025',
        data_prezzo: '2026-01-01',
        prezzo: 36,
      },
      {
        prodotto: 'Delivery from 9 - 12 OR AFTER 3.00PM 02077279957',
        note: null,
        data_prezzo: '2026-05-26',
        prezzo: 18.74,
      },
    ]
    expect(Object.keys(buildListinoByProduct(rows))).toEqual(['Beer Menabrea (61025)'])
  })
})

describe('isPromoListinoRow', () => {
  it('flags rows whose product name contains promo tokens', () => {
    expect(isPromoListinoRow({ prodotto: 'Menabrea Deal' })).toBe(true)
    expect(isPromoListinoRow({ prodotto: 'Sconto fedelta' })).toBe(true)
    expect(isPromoListinoRow({ prodotto: 'Promo Pasqua' })).toBe(true)
    expect(isPromoListinoRow({ prodotto: 'Bundle 6+1 birra' })).toBe(true)
    expect(isPromoListinoRow({ prodotto: 'Gift voucher' })).toBe(true)
  })

  it('flags rows whose code contains promo tokens', () => {
    expect(
      isPromoListinoRow({ prodotto: 'Beer Menabrea Blonde', note: 'codice:61MENABREA_DEAL · unita:24x33cl' }),
    ).toBe(true)
    expect(
      isPromoListinoRow({ prodotto: 'Beer Menabrea Blonde', note: 'codice:FOC123' }),
    ).toBe(true)
  })

  it('flags rows whose free-form note mentions FOC / free of charge', () => {
    expect(
      isPromoListinoRow({ prodotto: 'Beer Menabrea Blonde', note: 'codice:61025 · free of charge' }),
    ).toBe(true)
  })

  it('does NOT flag regular products', () => {
    expect(isPromoListinoRow({ prodotto: 'Beer Menabrea Blonde', note: 'codice:61025 · unita:24x33cl' })).toBe(false)
    expect(isPromoListinoRow({ prodotto: 'Hildon Still 750ml' })).toBe(false)
  })
})

describe('filterOutliersForTrend', () => {
  it('returns input as-is when fewer than 4 rows', () => {
    const rows = [{ prezzo: 1 }, { prezzo: 100 }]
    expect(filterOutliersForTrend(rows)).toBe(rows)
  })

  it('keeps the upper case-price cluster (Menabrea-like noisy OCR series)', () => {
    const rows = [
      { id: 'a', prezzo: 1.48 },
      { id: 'b', prezzo: 5.02 },
      { id: 'c', prezzo: 7.0 },
      { id: 'd', prezzo: 7.0 },
      { id: 'e', prezzo: 10.4 },
      { id: 'f', prezzo: 12.84 },
      { id: 'g', prezzo: 35.66 },
      { id: 'h', prezzo: 35.66 },
      { id: 'i', prezzo: 36.04 },
    ]
    const kept = filterOutliersForTrend(rows).map((r) => r.id)
    expect(kept).not.toContain('a')
    expect(kept).not.toContain('c')
    expect(kept).not.toContain('e')
    expect(kept).toContain('g')
    expect(kept).toContain('h')
    expect(kept).toContain('i')
  })

  it('bimodal split keeps the upper cluster when spread is wide', () => {
    const rows = [{ prezzo: 1 }, { prezzo: 1 }, { prezzo: 100 }, { prezzo: 100 }]
    const out = filterOutliersForTrend(rows)
    expect(out.length).toBe(2)
    expect(out.every((r) => r.prezzo === 100)).toBe(true)
  })

  it('falls back to input if the cluster filter would leave <2 rows', () => {
    const rows = [{ prezzo: 1 }, { prezzo: 1 }, { prezzo: 1 }, { prezzo: 100 }]
    expect(filterOutliersForTrend(rows).length).toBe(rows.length)
  })

  it('handles zero/negative median safely', () => {
    const rows = [{ prezzo: 0 }, { prezzo: 0 }, { prezzo: 1 }, { prezzo: 2 }]
    const out = filterOutliersForTrend(rows)
    expect(out.length).toBeGreaterThanOrEqual(2)
  })
})

describe('parsePackSizeFromListinoUnita', () => {
  it('reads pack count from 6x75cl style unit strings', () => {
    expect(parsePackSizeFromListinoUnita('6x75cl')).toBe(6)
    expect(parsePackSizeFromListinoUnita('24x33cl')).toBe(24)
    expect(parsePackSizeFromListinoUnita('X6')).toBe(6)
  })

  it('returns null for single-unit or order-qty patterns', () => {
    expect(parsePackSizeFromListinoUnita(null)).toBeNull()
    expect(parsePackSizeFromListinoUnita('each')).toBeNull()
    expect(parsePackSizeFromListinoUnita('2 casse')).toBeNull()
  })

  it('treats UK case format x 12 as per-case, not per-piece pack', () => {
    expect(isListinoCaseUnitFormat('x 12')).toBe(true)
    expect(isListinoCaseUnitFormat('X12')).toBe(true)
    expect(parsePackSizeFromListinoUnita('x 12')).toBeNull()
  })
})

describe('listinoPerPiecePriceHint', () => {
  it('shows per-piece when display price is for full pack (Chianti 6x75cl)', () => {
    const hint = listinoPerPiecePriceHint({
      displayUnitPrice: 63.66,
      unita: '6x75cl',
      otherPrices: [],
    })
    expect(hint).toEqual({ packSize: 6, perPiecePrice: 10.61 })
  })

  it('hides hint when display price is already per unit vs history', () => {
    expect(
      listinoPerPiecePriceHint({
        displayUnitPrice: 10.61,
        unita: '6x75cl',
        otherPrices: [10.5, 10.55],
      }),
    ).toBeNull()
  })

  it('shows per-piece when history is case-level (Gavi 6x75cl)', () => {
    const hint = listinoPerPiecePriceHint({
      displayUnitPrice: 61.5,
      unita: '6x75cl',
      otherPrices: [58, 60, 62],
    })
    expect(hint).toEqual({ packSize: 6, perPiecePrice: 10.25 })
  })
})

describe('pickDisplayListinoRow', () => {
  it('shows case price when latest OCR row is quantity (Menabrea)', () => {
    const rows = [
      { id: '1', data_prezzo: '2025-08-05', prezzo: 35.66 },
      { id: '2', data_prezzo: '2025-09-26', prezzo: 7.0 },
      { id: '3', data_prezzo: '2026-03-13', prezzo: 36.04 },
      { id: '4', data_prezzo: '2026-03-31', prezzo: 7.0 },
    ]
    const display = pickDisplayListinoRow(rows)
    expect(display.id).toBe('3')
    expect(display.prezzo).toBe(36.04)
  })

  it('skips latest row when it is a line-total OCR spike', () => {
    const rows = [
      { id: '1', data_prezzo: '2026-01-01', prezzo: 7.55 },
      { id: '2', data_prezzo: '2026-02-01', prezzo: 7.61 },
      { id: '3', data_prezzo: '2026-03-01', prezzo: 45.68 },
    ]
    const display = pickDisplayListinoRow(rows)
    expect(display.id).toBe('2')
    expect(displayListinoUnitPrice(display, rows)).toBeCloseTo(7.61, 2)
  })

  it('keeps latest row after a legitimate price increase (~50%)', () => {
    const rows = [
      { id: '1', data_prezzo: '2026-01-01', prezzo: 15.23 },
      { id: '2', data_prezzo: '2026-02-01', prezzo: 15.23 },
      { id: '3', data_prezzo: '2026-03-01', prezzo: 22.84 },
    ]
    const display = pickDisplayListinoRow(rows)
    expect(display.id).toBe('3')
    expect(displayListinoUnitPrice(display, rows)).toBeCloseTo(22.84, 2)
  })

  it('returns chronological latest when it is in the plausible cluster', () => {
    const rows = [
      { id: '1', data_prezzo: '2026-01-01', prezzo: 35.66 },
      { id: '2', data_prezzo: '2026-02-01', prezzo: 36.04 },
    ]
    expect(pickDisplayListinoRow(rows).id).toBe('2')
  })
})

describe('dynamicStaleThresholdDays', () => {
  it('returns default 60 days for series with <3 dates', () => {
    expect(dynamicStaleThresholdDays([])).toBe(60)
    expect(dynamicStaleThresholdDays(['2026-01-01'])).toBe(60)
    expect(dynamicStaleThresholdDays(['2026-01-01', '2026-01-15'])).toBe(60)
  })

  it('returns ~2x median interval for a weekly purchase series', () => {
    const dates = ['2026-01-01', '2026-01-08', '2026-01-15', '2026-01-22', '2026-01-29']
    const t = dynamicStaleThresholdDays(dates)
    expect(t).toBe(30)
  })

  it('returns ~2x median interval for a monthly purchase series', () => {
    const dates = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01']
    const t = dynamicStaleThresholdDays(dates)
    expect(t).toBeGreaterThanOrEqual(58)
    expect(t).toBeLessThanOrEqual(62)
  })

  it('caps very long intervals at 365 days', () => {
    const dates = ['2025-01-01', '2026-01-01', '2026-12-31']
    expect(dynamicStaleThresholdDays(dates)).toBeLessThanOrEqual(365)
  })

  it('floors very short intervals at 30 days', () => {
    const dates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']
    expect(dynamicStaleThresholdDays(dates)).toBe(30)
  })
})

describe('productNamesMatchForVerifica', () => {
  it('matches OCR variants of the same product name', () => {
    expect(
      productNamesMatchForVerifica(
        'M8000B BLACK M WAVEABLE CONT 880cc X400',
        'BLACK M WAVEABLE CONTAINER 880cc x400 M8000B',
      ),
    ).toBe(true)
  })

  it('does not match unrelated products', () => {
    expect(productNamesMatchForVerifica('Beer Menabrea 61025', 'Olive oil 5L')).toBe(false)
  })
})

describe('checkResultMatchesVerificaProdotto', () => {
  it('matches by listino codice on rekki line', () => {
    const row = {
      numero: 'INV-1',
      bolle: [
        {
          id: '1',
          numero_bolla: 'DN-1',
          importo: 10,
          data: '2026-01-01',
          rekki_meta: { prodotto: 'Container black 500cc', codice: 'MWB500' },
        },
      ],
    }
    expect(checkResultMatchesVerificaProdotto(row, 'unrelated name', 'MWB500')).toBe(true)
  })

  it('matches rekki_meta.prodotto on bolla lines', () => {
    const row = {
      numero: 'INV-99',
      bolle: [
        {
          id: '1',
          numero_bolla: 'DN-1',
          importo: 10,
          data: '2026-01-01',
          rekki_meta: { prodotto: 'MWB500 BLACK MICROWAVE CONTAINER' },
        },
      ],
    }
    expect(checkResultMatchesVerificaProdotto(row, '500cc BLACK MICROWAVE CONTAINER & LIDS')).toBe(true)
  })
})

describe('resolveVerificaDisplayRows', () => {
  const rows = [
    { numero: 'A', status: 'ok', bolle: [] },
    { numero: 'B', status: 'fattura_mancante', bolle: [] },
    {
      numero: 'C',
      status: 'rekki_prezzo_discordanza',
      bolle: [{ id: '1', numero_bolla: 'x', importo: 1, data: '2026-01-01', rekki_meta: { prodotto: 'Beer X' } }],
    },
  ]

  it('shows statement anomalies when product filter misses but anomalies exist', () => {
    const r = resolveVerificaDisplayRows(rows, {
      checkFilter: 'all',
      verificaProdotto: 'ZZZ_NO_MATCH_XYZ',
      deepLink: true,
    })
    expect(r.mode).toBe('stmt_anomalies')
    expect(r.rows.some((x) => x.status === 'fattura_mancante')).toBe(true)
  })

  it('falls back to all statement rows when product missing and only ok lines', () => {
    const onlyOk = [{ numero: 'A', status: 'ok', bolle: [] }]
    const r = resolveVerificaDisplayRows(onlyOk, {
      checkFilter: 'all',
      verificaProdotto: 'ZZZ_NO_MATCH_XYZ',
      deepLink: true,
    })
    expect(r.mode).toBe('all_fallback')
    expect(r.rows).toHaveLength(1)
  })
})

describe('formatListinoPriceChangePct', () => {
  it('formats large Italian percentages with thousands separator', () => {
    expect(formatListinoPriceChangePct(3496.6, 'it')).toBe('+3.497%')
    expect(formatListinoPriceChangePct(-1200, 'it')).toBe('-1.200%')
  })

  it('formats English locale', () => {
    expect(formatListinoPriceChangePct(3496.6, 'en')).toBe('+3,497%')
  })

  it('rounds medium and small changes', () => {
    expect(formatListinoPriceChangePct(12.4, 'it')).toBe('+12%')
    expect(formatListinoPriceChangePct(3.45, 'it')).toBe('+3,5%')
    expect(formatListinoPriceChangePct(0, 'it')).toBe('0%')
  })
})

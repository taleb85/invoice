import { describe, expect, it } from 'vitest'
import {
  parseListinoNoteParts,
  isPromoListinoRow,
  filterOutliersForTrend,
  dynamicStaleThresholdDays,
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

  it('keeps the dominant price cluster (Menabrea-like noisy OCR series)', () => {
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
    expect(kept).not.toContain('g')
    expect(kept).not.toContain('h')
    expect(kept).not.toContain('i')
    expect(kept).toContain('c')
    expect(kept).toContain('e')
  })

  it('falls back to input if the cluster filter would leave <2 rows', () => {
    const rows = [{ prezzo: 1 }, { prezzo: 1 }, { prezzo: 100 }, { prezzo: 100 }]
    expect(filterOutliersForTrend(rows).length).toBe(rows.length)
  })

  it('handles zero/negative median safely', () => {
    const rows = [{ prezzo: 0 }, { prezzo: 0 }, { prezzo: 1 }, { prezzo: 2 }]
    const out = filterOutliersForTrend(rows)
    expect(out.length).toBeGreaterThanOrEqual(2)
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

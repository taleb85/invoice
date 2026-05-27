import { describe, expect, it } from 'vitest'
import { parseListinoNoteParts } from '@/lib/listino-display'

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

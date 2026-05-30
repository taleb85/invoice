import { describe, expect, it } from 'vitest'
import {
  findListinoPriceRepairs,
  shouldApplyListinoPriceRepair,
} from '@/lib/listino-price-repair'

describe('findListinoPriceRepairs', () => {
  it('TOWE02N: totale riga con Qtà fattura in nota', () => {
    const repairs = findListinoPriceRepairs([
      {
        id: '1',
        fornitore_id: 'f1',
        prodotto: 'MIDI BLUE C-FEED ROLL',
        prezzo: 17.98,
        data_prezzo: '2025-06-05',
        note: 'Codice: TOWE02N — Qtà fattura: 2',
      },
    ])
    expect(repairs).toHaveLength(1)
    expect(repairs[0]!.correctedPrezzo).toBe(8.99)
  })

  it('FOIL45: doppio rispetto a storico plausibile', () => {
    const repairs = findListinoPriceRepairs([
      {
        id: '1',
        fornitore_id: 'f1',
        prodotto: 'CATERING FOIL',
        prezzo: 6.59,
        data_prezzo: '2026-05-21',
        note: 'Codice: FOIL45',
      },
      {
        id: '2',
        fornitore_id: 'f1',
        prodotto: 'CATERING FOIL',
        prezzo: 13.18,
        data_prezzo: '2026-05-22',
        note: 'Codice: FOIL45 — Qtà fattura: 2',
      },
    ])
    const r = repairs.find((x) => x.id === '2')
    expect(r?.correctedPrezzo).toBe(6.59)
  })

  it('non dimezza unitario già corretto con Qtà in nota', () => {
    expect(
      shouldApplyListinoPriceRepair(8.99, 4.5, [17.98], 'Codice: TOWE02N — Qtà fattura: 2'),
    ).toBe(false)
  })

  it('non modifica prezzo unitario già corretto', () => {
    const repairs = findListinoPriceRepairs([
      {
        id: '1',
        fornitore_id: 'f1',
        prodotto: 'NAPKIN',
        prezzo: 81.62,
        data_prezzo: '2026-05-21',
        note: null,
      },
    ])
    expect(repairs).toHaveLength(0)
  })

  it('non corregge la riga listino già a 6.59 se esiste anche 13.18 errato', () => {
    const repairs = findListinoPriceRepairs([
      {
        id: 'ok',
        fornitore_id: 'f1',
        prodotto: 'CATERING FOIL',
        prezzo: 6.59,
        data_prezzo: '2026-05-21',
        note: 'Codice: FOIL45 — Qtà fattura: 2',
      },
      {
        id: 'bad',
        fornitore_id: 'f1',
        prodotto: 'CATERING FOIL',
        prezzo: 13.18,
        data_prezzo: '2026-05-21',
        note: 'Codice: FOIL45 — Qtà fattura: 2',
      },
    ])
    expect(repairs.find((r) => r.id === 'ok')).toBeUndefined()
    expect(repairs.find((r) => r.id === 'bad')?.correctedPrezzo).toBe(6.59)
  })
})

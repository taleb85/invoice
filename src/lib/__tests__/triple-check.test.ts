import { describe, expect, it } from 'vitest'
import {
  amountsMatchForTripleCheck,
  findMatchingBolleForFattura,
  type TripleCheckBollaRow,
} from '@/lib/triple-check'

describe('findMatchingBolleForFattura', () => {
  const pool: TripleCheckBollaRow[] = [
    { id: 'b1', numero_bolla: 'SDN600687', importo: 36, data: '2026-02-18', fornitore_id: 'f1' },
    { id: 'b2', numero_bolla: 'SDN636554', importo: 171.27, data: '2026-03-30', fornitore_id: 'f1' },
    { id: 'b3', numero_bolla: 'SDN640603', importo: 137.87, data: '2026-04-02', fornitore_id: 'f1' },
  ]

  it('preferisce bolla collegata via bolla_id', () => {
    const matched = findMatchingBolleForFattura(
      { fornitore_id: 'f1', data: '2026-04-02', importo: 137.87, bolla_id: 'b3' },
      pool,
      137.87,
    )
    expect(matched).toHaveLength(1)
    expect(matched[0].id).toBe('b3')
  })

  it('match per importo e data stretta senza sommare tutte le bolle del periodo', () => {
    const matched = findMatchingBolleForFattura(
      { fornitore_id: 'f1', data: '2026-04-02', importo: 137.87, bolla_id: null },
      pool,
      137.87,
    )
    expect(matched).toHaveLength(1)
    expect(matched[0].numero_bolla).toBe('SDN640603')
  })

  it('non confonde fatture diverse nello stesso mese', () => {
    const matched = findMatchingBolleForFattura(
      { fornitore_id: 'f1', data: '2026-03-30', importo: 171.27, bolla_id: null },
      pool,
      171.27,
    )
    expect(matched).toHaveLength(1)
    expect(matched[0].numero_bolla).toBe('SDN636554')
  })

  it('restituisce array vuoto se nessuna bolla compatibile', () => {
    const matched = findMatchingBolleForFattura(
      { fornitore_id: 'f1', data: '2026-05-01', importo: 999, bolla_id: null },
      pool,
      999,
    )
    expect(matched).toEqual([])
  })
})

describe('amountsMatchForTripleCheck', () => {
  it('accetta differenze entro tolleranza', () => {
    expect(amountsMatchForTripleCheck(137.87, 137.90)).toBe(true)
    expect(amountsMatchForTripleCheck(137.87, 138.00)).toBe(false)
  })
})

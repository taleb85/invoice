import { describe, expect, it } from 'vitest'
import {
  formatBollaQuantita,
  quantitaForBollaFromOcr,
  quantitaFromDocMetadata,
} from '@/lib/bolla-quantita'

describe('quantitaForBollaFromOcr', () => {
  it('returns quantity for bolla_ddt only', () => {
    expect(quantitaForBollaFromOcr({ tipo_documento: 'bolla_ddt', quantita_totale: 12 })).toBe(12)
    expect(quantitaForBollaFromOcr({ tipo_documento: 'fattura', quantita_totale: 12 })).toBeNull()
  })
})

describe('quantitaFromDocMetadata', () => {
  it('sums rekki line quantities', () => {
    expect(
      quantitaFromDocMetadata({
        rekki_lines: [{ quantita: 3 }, { quantita: 2.5 }],
      }),
    ).toBe(5.5)
  })
})

describe('formatBollaQuantita', () => {
  it('formats or em dash', () => {
    expect(formatBollaQuantita(10.5, 'en-GB')).toMatch(/10/)
    expect(formatBollaQuantita(null, 'en-GB')).toBe('—')
  })
})

import { describe, expect, it } from 'vitest'
import { analyzeFatturaDuplicatesForDeletion } from '@/lib/check-duplicates'

describe('analyzeFatturaDuplicatesForDeletion', () => {
  it('flags same supplier + date + amount with different OCR invoice numbers', () => {
    const analysis = analyzeFatturaDuplicatesForDeletion([
      {
        id: 'a',
        fornitore_id: 'f1',
        data: '2026-04-17',
        importo: 26.71,
        numero_fattura: '853955',
        file_url: 'https://x/doc/Sales Invoice-853955.pdf',
      },
      {
        id: 'b',
        fornitore_id: 'f1',
        data: '2026-04-17',
        importo: 26.71,
        numero_fattura: '525576',
        file_url: 'https://x/doc/email_auto_356ac91c.pdf',
      },
    ])
    expect(analysis.excessIds.has('b')).toBe(true)
    expect(analysis.excessIds.has('a')).toBe(false)
    expect(analysis.memberIds.has('a')).toBe(true)
    expect(analysis.memberIds.has('b')).toBe(true)
  })

  it('does not group different amounts on same day', () => {
    const analysis = analyzeFatturaDuplicatesForDeletion([
      {
        id: 'a',
        fornitore_id: 'f1',
        data: '2026-04-17',
        importo: 26.71,
        numero_fattura: '1',
      },
      {
        id: 'b',
        fornitore_id: 'f1',
        data: '2026-04-17',
        importo: 30,
        numero_fattura: '2',
      },
    ])
    expect(analysis.excessIds.size).toBe(0)
  })
})

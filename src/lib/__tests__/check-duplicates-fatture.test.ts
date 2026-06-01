import { describe, expect, it } from 'vitest'
import {
  analyzeFatturaDuplicatesForDeletion,
  fatturaExcessIdsForAutoDeletion,
} from '@/lib/check-duplicates'

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

  it('auto-delete esclude solo data+importo con numeri OCR diversi', () => {
    const rows = [
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
    ]
    expect(analyzeFatturaDuplicatesForDeletion(rows).excessIds.has('b')).toBe(true)
    expect(fatturaExcessIdsForAutoDeletion(rows)).toEqual([])
  })

  it('auto-delete include stesso file_url', () => {
    const url = 'https://x/same.pdf'
    const rows = [
      {
        id: 'old',
        fornitore_id: 'f1',
        data: '2026-04-01',
        importo: 10,
        numero_fattura: '1',
        file_url: url,
      },
      {
        id: 'new',
        fornitore_id: 'f1',
        data: '2026-04-02',
        importo: 20,
        numero_fattura: '2',
        file_url: url,
      },
    ]
    expect(fatturaExcessIdsForAutoDeletion(rows)).toEqual(['new'])
  })
})
